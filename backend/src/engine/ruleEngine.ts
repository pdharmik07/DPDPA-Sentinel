/**
 * Deterministic rule engine.
 *
 * Evaluation order for every rule:
 *
 *   1. Applicability  -> NOT_APPLICABLE short-circuits, excluded from scoring
 *   2. Detection      -> anchors / supporting / specifics over a context window
 *   3. NLP enrichment -> semantic similarity raises confidence only
 *   4. Negation gate  -> a denied obligation cannot pass, whatever the similarity
 *   5. Status         -> PASS | PARTIAL | FAIL
 *   6. Evidence       -> the sentences that justify the decision
 *
 * The critical invariant, enforced structurally in `decideStatus`: a PASS
 * requires a non-negated anchor match AND at least half the rule's specific
 * sub-elements. Semantic similarity is only ever an input to `confidence`, so
 * it can never on its own produce a PASS.
 */

import { evaluateApplicability } from './applicability.js';
import { hasHedging, hasNegation } from './text.js';
import {
  MAX_POINTS,
  POINTS,
  type CompiledRule,
  type EvidenceItem,
  type Finding,
  type NlpAnalysis,
  type NlpRuleSignal,
  type PreparedDocument,
  type RuleStatus,
  type Sentence,
} from './types.js';

const MAX_EVIDENCE = 4;
/** Sentences shorter than this cannot carry a real clause. */
const MIN_SENTENCE_CHARS = 25;
/** Similarity below this contributes nothing. */
const SEMANTIC_FLOOR = 0.45;
/** Hard ceiling on how much the semantic layer can move confidence. */
const SEMANTIC_MAX_BONUS = 0.12;

interface SentenceMatch {
  sentence: Sentence;
  anchorHit: boolean;
  supportHits: number;
  score: number;
  negated: boolean;
  hedged: boolean;
  semanticScore: number | null;
}

function clamp(n: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, n));
}

/**
 * Negative-polarity cues that flip a negative indicator into a commitment.
 *
 * "Nothing is pre-selected" and "we never use pre-ticked boxes" both contain a
 * phrase that looks like a violation, but both are the opposite. Testing the
 * whole sentence for these words is too blunt — it would excuse a genuine
 * violation that happens to contain "not" elsewhere — so the check is scoped to
 * the text immediately preceding the matched indicator.
 */
const NEGATIVE_POLARITY =
  /\b(no|not|none|nothing|nowhere|never|without|nor|un(ticked|checked|selected))\b/i;

const POLARITY_WINDOW = 60;

function isDisclaimed(sentence: string, indicator: RegExp): boolean {
  // `indicator` is a non-global RegExp from the rule pack, so exec is stateless.
  const match = indicator.exec(sentence);
  if (!match) return false;
  const before = sentence.slice(Math.max(0, match.index - POLARITY_WINDOW), match.index);
  return NEGATIVE_POLARITY.test(before);
}

function matchSentences(
  rule: CompiledRule,
  doc: PreparedDocument,
  signal: NlpRuleSignal | undefined,
): SentenceMatch[] {
  const semanticByIndex = new Map<number, number>();
  if (signal) for (const s of signal.sentences) semanticByIndex.set(s.index, s.similarity);

  const matches: SentenceMatch[] = [];

  for (const sentence of doc.sentences) {
    if (sentence.text.length < MIN_SENTENCE_CHARS) continue;

    const anchorHit = rule.compiled.anchors.some((p) => p.test(sentence.text));
    const supportHits = rule.compiled.supporting.reduce((n, p) => (p.test(sentence.text) ? n + 1 : n), 0);
    const semanticScore = semanticByIndex.get(sentence.index) ?? null;

    // A sentence enters the evidence pool on a deterministic signal, or on a
    // strong semantic signal. Semantic-only sentences still cannot produce a
    // PASS — see decideStatus — but they should be visible as evidence.
    const semanticallyRelevant = semanticScore !== null && semanticScore >= 0.6;
    if (!anchorHit && supportHits === 0 && !semanticallyRelevant) continue;

    const negated = hasNegation(sentence.text);
    const hedged = hasHedging(sentence.text);

    let score = anchorHit ? 1 : 0;
    score += Math.min(supportHits, 3) * 0.12;
    if (semanticScore !== null && semanticScore > SEMANTIC_FLOOR) {
      score += (semanticScore - SEMANTIC_FLOOR) * 0.4;
    }
    if (negated) score *= 0.3;
    if (hedged) score *= 0.85;

    matches.push({ sentence, anchorHit, supportHits, score, negated, hedged, semanticScore });
  }

  return matches.sort((a, b) => b.score - a.score);
}

/**
 * Local context around the top matches. Specific sub-elements are only counted
 * if they appear near the clause, so an unrelated "30 days" elsewhere in the
 * document cannot satisfy a retention requirement.
 */
function buildContext(matches: SentenceMatch[], doc: PreparedDocument): string {
  const wanted = new Set<number>();
  for (const m of matches.slice(0, 8)) {
    for (let i = m.sentence.index - 1; i <= m.sentence.index + 2; i += 1) {
      if (i >= 0 && i < doc.sentences.length) wanted.add(i);
    }
  }
  return [...wanted]
    .sort((a, b) => a - b)
    .map((i) => doc.sentences[i]?.text ?? '')
    .join(' ');
}

function decideStatus(input: {
  confidence: number;
  nonNegatedAnchors: number;
  specificRatio: number;
  raised: boolean;
  negationDetected: boolean;
  contradicted: boolean;
  selfContradictory: boolean;
}): RuleStatus {
  // A live contradiction of the requirement is a failure regardless of score.
  if (input.contradicted) return 'FAIL';

  // The obligation is mentioned but denied, and nothing affirms it.
  if (input.negationDetected && input.nonNegatedAnchors === 0) return 'FAIL';

  // PASS is gated on deterministic structure, never on similarity alone.
  if (input.confidence >= 0.7 && input.nonNegatedAnchors > 0 && input.specificRatio >= 0.5) {
    // A policy that both grants and denies the same obligation is ambiguous.
    // It cannot be relied on, so it is capped at PARTIAL and surfaced for human
    // review rather than passed on the strength of the favourable clause alone.
    return input.selfContradictory ? 'PARTIAL' : 'PASS';
  }
  if (input.confidence >= 0.36) return 'PARTIAL';
  return 'FAIL';
}

function buildReasoning(
  rule: CompiledRule,
  status: RuleStatus,
  ctx: {
    missingSpecifics: string[];
    negationDetected: boolean;
    hedgingDetected: boolean;
    contradicted: boolean;
    contradictionText: string | null;
    raised: boolean;
    semanticSupport: boolean;
    selfContradictory: boolean;
  },
): string {
  const title = rule.title.toLowerCase();

  if (ctx.contradicted) {
    return `The policy contains language that directly contradicts this requirement${
      ctx.contradictionText ? `: "${truncate(ctx.contradictionText, 160)}"` : ''
    }.`;
  }

  if (status === 'FAIL' && ctx.negationDetected) {
    return `The policy refers to ${title} but states the obligation is not met or not offered, so the requirement is not satisfied.`;
  }

  if (status === 'FAIL' && !ctx.raised) {
    const semantic = ctx.semanticSupport
      ? ' Semantically related wording was found but was too weak to establish the clause.'
      : '';
    return `No clause addressing ${title} was found anywhere in the policy.${semantic}`;
  }

  if (status === 'FAIL') {
    return `${rule.title} is mentioned only in passing, without the substance the requirement calls for.`;
  }

  if (status === 'PARTIAL' && ctx.selfContradictory) {
    return (
      `The policy both asserts and denies ${title}. Contradictory clauses cannot be relied on, ` +
      'so this requirement is flagged for human review rather than passed.'
    );
  }

  if (status === 'PARTIAL') {
    const gaps = ctx.missingSpecifics.length
      ? ` Missing: ${ctx.missingSpecifics.join('; ').toLowerCase()}.`
      : '';
    const hedge = ctx.hedgingDetected
      ? ' The commitment is hedged with discretionary language, so it is not binding.'
      : '';
    const semantic = ctx.semanticSupport
      ? ' Semantically related wording supports the match but does not complete it.'
      : '';
    return `The policy addresses ${title} but does not fully satisfy the requirement.${gaps}${hedge}${semantic}`;
  }

  return `The policy satisfies this requirement, with the specific elements the obligation calls for present in the clause.`;
}

function truncate(s: string, n: number): string {
  return s.length <= n ? s : `${s.slice(0, n - 1).trimEnd()}…`;
}

export function legalReferenceOf(rule: CompiledRule): string {
  const parts: string[] = [];
  if (rule.actSection) parts.push(`DPDPA 2023, ${rule.actSection}`);
  if (rule.ruleReference) parts.push(`DPDP Rules 2025, ${rule.ruleReference}`);
  if (rule.scheduleReference) parts.push(rule.scheduleReference);
  if (!parts.length) return rule.legalBasis ?? 'Project-specific check';
  return parts.join('; ');
}

export function evaluateRule(
  rule: CompiledRule,
  doc: PreparedDocument,
  nlp: NlpAnalysis,
): Finding {
  const maxPoints = MAX_POINTS[rule.weightClass];
  const legalReference = legalReferenceOf(rule);

  // ── 1. Applicability ────────────────────────────────────────────────────
  const applicability = evaluateApplicability(rule, doc);
  if (!applicability.applicable) {
    return {
      ruleId: rule.ruleId,
      rule,
      status: 'NOT_APPLICABLE',
      applicable: false,
      applicabilityReason: applicability.reason,
      confidence: 0,
      credit: 0,
      points: 0,
      maxPoints,
      evidence: [],
      matchedSpecifics: [],
      missingSpecifics: [],
      negationDetected: false,
      hedgingDetected: false,
      semanticSupport: false,
      reasoning: applicability.reason ?? 'Not applicable.',
      legalReference,
      severity: rule.severity,
    };
  }

  // ── 2. Detection ────────────────────────────────────────────────────────
  const signal = nlp.byRule[rule.ruleId];
  const matches = matchSentences(rule, doc, signal);
  const nonNegatedAnchors = matches.filter((m) => m.anchorHit && !m.negated);

  const context = buildContext(matches, doc);
  const matchedSpecifics: string[] = [];
  const missingSpecifics: string[] = [];
  for (const spec of rule.compiled.specifics) {
    if (spec.pattern.test(context)) matchedSpecifics.push(spec.label);
    else missingSpecifics.push(spec.label);
  }
  const specificRatio = rule.compiled.specifics.length
    ? matchedSpecifics.length / rule.compiled.specifics.length
    : 1;

  // ── 3. Confidence, including the bounded NLP contribution ───────────────
  const anchorSignal = nonNegatedAnchors.length >= 2 ? 1 : nonNegatedAnchors.length === 1 ? 0.72 : 0;
  const supportSignal = Math.min(1, matches.reduce((n, m) => n + m.supportHits, 0) / 4);

  let confidence =
    nonNegatedAnchors.length > 0
      ? 0.46 * anchorSignal + 0.14 * supportSignal + 0.4 * specificRatio
      : Math.min(0.36, 0.22 * supportSignal + 0.14 * specificRatio);

  const bestSimilarity = signal?.bestSimilarity ?? 0;
  const semanticBonus =
    bestSimilarity > SEMANTIC_FLOOR
      ? Math.min(SEMANTIC_MAX_BONUS, (bestSimilarity - SEMANTIC_FLOOR) * 0.3)
      : 0;
  const semanticSupport = semanticBonus > 0;
  confidence += semanticBonus;

  const top = matches.slice(0, MAX_EVIDENCE);
  const negationDetected = matches.length > 0 && matches.slice(0, 2).every((m) => m.negated);
  const hedgingDetected = top.length > 0 && top.every((m) => m.hedged);

  // Conservative bias: ambiguity is flagged, never waved through.
  if (negationDetected) confidence *= 0.35;
  if (hedgingDetected) confidence *= 0.78;
  confidence = clamp(confidence, 0, 1);

  // ── 4. Direct contradiction of the requirement ──────────────────────────
  let contradictionText: string | null = null;
  outer: for (const s of doc.sentences) {
    for (const indicator of rule.compiled.negativeIndicators) {
      if (indicator.test(s.text) && !isDisclaimed(s.text, indicator)) {
        contradictionText = s.text;
        break outer;
      }
    }
  }

  const raised = matches.some((m) => m.anchorHit) || matches.some((m) => m.supportHits >= 2);

  // The document both affirms and denies this obligation in anchor sentences.
  const negatedAnchors = matches.filter((m) => m.anchorHit && m.negated);
  const selfContradictory = nonNegatedAnchors.length > 0 && negatedAnchors.length > 0;

  // ── 5. Status ───────────────────────────────────────────────────────────
  const status = decideStatus({
    confidence,
    nonNegatedAnchors: nonNegatedAnchors.length,
    specificRatio,
    raised,
    negationDetected,
    contradicted: contradictionText !== null,
    selfContradictory,
  });

  const points = POINTS[rule.weightClass][status as Exclude<RuleStatus, 'NOT_APPLICABLE'>] ?? 0;
  const credit = maxPoints > 0 ? points / maxPoints : 0;

  // ── 6. Evidence ─────────────────────────────────────────────────────────
  const evidence: EvidenceItem[] = top.map((m) => ({
    sentence: m.sentence.text,
    index: m.sentence.index,
    paragraph: m.sentence.paragraph,
    score: Number(m.score.toFixed(3)),
    negated: m.negated,
    hedged: m.hedged,
    semanticScore: m.semanticScore === null ? null : Number(m.semanticScore.toFixed(3)),
  }));

  // Surface the contradicting sentence as evidence even if it did not rank.
  if (contradictionText && !evidence.some((e) => e.sentence === contradictionText)) {
    const s = doc.sentences.find((x) => x.text === contradictionText);
    if (s) {
      evidence.unshift({
        sentence: s.text,
        index: s.index,
        paragraph: s.paragraph,
        score: 0,
        negated: false,
        hedged: false,
        semanticScore: null,
      });
    }
  }

  return {
    ruleId: rule.ruleId,
    rule,
    status,
    applicable: true,
    applicabilityReason: applicability.reason,
    confidence: Number(confidence.toFixed(4)),
    credit,
    points,
    maxPoints,
    evidence,
    matchedSpecifics,
    missingSpecifics,
    negationDetected,
    hedgingDetected,
    semanticSupport,
    reasoning: buildReasoning(rule, status, {
      missingSpecifics,
      negationDetected,
      hedgingDetected,
      contradicted: contradictionText !== null,
      contradictionText,
      raised,
      semanticSupport,
      selfContradictory,
    }),
    legalReference,
    severity: rule.severity,
  };
}

export function evaluateAll(
  rules: CompiledRule[],
  doc: PreparedDocument,
  nlp: NlpAnalysis,
): Finding[] {
  return rules.map((r) => evaluateRule(r, doc, nlp));
}
