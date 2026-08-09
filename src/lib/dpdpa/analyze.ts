import { CATEGORIES } from './categories';
import { CONCEPTS } from './concepts';
import { REQUIREMENTS, weightOf } from './requirements';
import { countWords, detectSections, hasHedging, hasNegation, splitParagraphs, splitSentences } from './text';
import type {
  CategoryScore,
  ComplianceStatus,
  ConceptFinding,
  DocumentStats,
  Evidence,
  Requirement,
  RequirementFinding,
  RiskItem,
  RiskLevel,
  ScanResult,
} from './types';
import { clamp, shortId } from '../utils';

/** Credit awarded toward the weighted score, per status. */
const CREDIT: Record<ComplianceStatus, number> = {
  compliant: 1,
  partial: 0.5,
  non_compliant: 0,
  not_detected: 0,
  not_applicable: 0,
};

const MAX_EVIDENCE = 4;

interface SentenceMatch {
  index: number;
  sentence: string;
  anchorHit: boolean;
  supportHits: number;
  score: number;
  negated: boolean;
  hedged: boolean;
}

function matchSentences(req: Requirement, sentences: string[]): SentenceMatch[] {
  const matches: SentenceMatch[] = [];

  sentences.forEach((sentence, index) => {
    // Skip fragments too short to carry a real clause.
    if (sentence.length < 25) return;

    const anchorHit = req.anchors.some((p) => p.test(sentence));
    const supportHits = req.supporting.reduce((n, p) => (p.test(sentence) ? n + 1 : n), 0);
    if (!anchorHit && supportHits === 0) return;

    const negated = hasNegation(sentence);
    const hedged = hasHedging(sentence);

    let score = anchorHit ? 1 : 0;
    score += Math.min(supportHits, 3) * 0.12;
    if (negated) score *= 0.3;
    if (hedged) score *= 0.85;

    matches.push({ index, sentence, anchorHit, supportHits, score, negated, hedged });
  });

  return matches.sort((a, b) => b.score - a.score);
}

/**
 * Builds the local context around the matched sentences. Specific sub-elements
 * (a retention *period*, a grievance *email*) are only counted if they appear
 * near the clause, so an unrelated "30 days" elsewhere in the policy cannot
 * satisfy the retention requirement.
 */
function buildContext(matches: SentenceMatch[], sentences: string[]): string {
  const wanted = new Set<number>();
  for (const m of matches.slice(0, 8)) {
    for (let i = m.index - 1; i <= m.index + 2; i += 1) {
      if (i >= 0 && i < sentences.length) wanted.add(i);
    }
  }
  return Array.from(wanted)
    .sort((a, b) => a - b)
    .map((i) => sentences[i])
    .join(' ');
}

function statusFor(
  confidence: number,
  anchorMatches: number,
  specificRatio: number,
  raised: boolean,
): ComplianceStatus {
  if (confidence >= 0.7 && anchorMatches > 0 && specificRatio >= 0.5) return 'compliant';
  if (confidence >= 0.36) return 'partial';
  // "Non-compliant" is reserved for obligations the document actually raises and
  // then fails. A stray keyword ("necessary", "correct") is absence, not failure.
  if (raised) return 'non_compliant';
  return 'not_detected';
}

function riskFor(req: Requirement, status: ComplianceStatus): RiskLevel {
  if (status === 'compliant' || status === 'not_applicable') return 'none';

  const missing = status === 'not_detected' || status === 'non_compliant';
  if (req.weightClass === 'mandatory') return missing ? 'critical' : 'high';
  if (req.weightClass === 'conditional') return missing ? 'high' : 'medium';
  return missing ? 'medium' : 'low';
}

function issueFor(
  req: Requirement,
  status: ComplianceStatus,
  missingSpecifics: string[],
  negated: boolean,
  hedged: boolean,
): string {
  if (status === 'not_applicable') {
    return `No content in the document triggers this conditional obligation, so it has been excluded from the score.`;
  }
  if (status === 'not_detected') {
    return `No clause addressing ${req.title.toLowerCase()} was found anywhere in the policy.`;
  }
  if (status === 'non_compliant') {
    if (negated) {
      return `The policy refers to ${req.title.toLowerCase()} but states the obligation is not met or not offered.`;
    }
    return `${req.title} is mentioned only in passing, without the substance the obligation requires.`;
  }
  if (status === 'partial') {
    const gaps = missingSpecifics.length
      ? ` Missing: ${missingSpecifics.join('; ').toLowerCase()}.`
      : '';
    const hedgeNote = hedged
      ? ' The commitment is hedged with discretionary language, so it is not binding.'
      : '';
    return `The policy addresses ${req.title.toLowerCase()} but does not fully satisfy the requirement.${gaps}${hedgeNote}`;
  }
  return `The policy satisfies this requirement.`;
}

function analyzeRequirement(
  req: Requirement,
  sentences: string[],
  fullText: string,
): RequirementFinding {
  const matches = matchSentences(req, sentences);
  const anchorMatches = matches.filter((m) => m.anchorHit && !m.negated);

  // Conditional obligations that nothing in the document triggers drop out of
  // the denominator instead of being scored as a failure.
  if (req.weightClass === 'conditional' && req.applicabilityTriggers) {
    const triggered = req.applicabilityTriggers.some((p) => p.test(fullText));
    if (!triggered) {
      return {
        requirement: req,
        status: 'not_applicable',
        confidence: 0,
        credit: 0,
        weight: weightOf(req),
        risk: 'none',
        evidence: [],
        matchedSpecifics: [],
        missingSpecifics: [],
        negationDetected: false,
        hedgingDetected: false,
        issue: issueFor(req, 'not_applicable', [], false, false),
      };
    }
  }

  const context = buildContext(matches, sentences);
  const matchedSpecifics: string[] = [];
  const missingSpecifics: string[] = [];
  for (const spec of req.specifics) {
    if (spec.pattern.test(context)) matchedSpecifics.push(spec.label);
    else missingSpecifics.push(spec.label);
  }
  const specificRatio = req.specifics.length ? matchedSpecifics.length / req.specifics.length : 1;

  // A well-drafted policy usually states each obligation once, so a single clear
  // anchor sentence must already count as a strong signal.
  const anchorSignal = anchorMatches.length >= 2 ? 1 : anchorMatches.length === 1 ? 0.72 : 0;
  const supportSignal = Math.min(1, matches.reduce((n, m) => n + m.supportHits, 0) / 4);

  let confidence =
    anchorMatches.length > 0
      ? 0.46 * anchorSignal + 0.14 * supportSignal + 0.4 * specificRatio
      : Math.min(0.36, 0.22 * supportSignal + 0.14 * specificRatio);

  const top = matches.slice(0, MAX_EVIDENCE);
  const negationDetected = matches.length > 0 && matches.slice(0, 2).every((m) => m.negated);
  const hedgingDetected = top.length > 0 && top.every((m) => m.hedged);

  // Conservative bias: ambiguity is flagged, never waved through.
  if (negationDetected) confidence *= 0.35;
  if (hedgingDetected) confidence *= 0.78;
  confidence = clamp(confidence, 0, 1);

  // The obligation counts as "raised" only if the document anchors on it, or a
  // sentence carries several supporting terms at once.
  const raised =
    matches.some((m) => m.anchorHit) || matches.some((m) => m.supportHits >= 2);

  const status = statusFor(confidence, anchorMatches.length, specificRatio, raised);

  const evidence: Evidence[] = top.map((m) => ({
    sentence: m.sentence,
    index: m.index,
    score: Number(m.score.toFixed(3)),
    negated: m.negated,
    hedged: m.hedged,
  }));

  return {
    requirement: req,
    status,
    confidence,
    credit: CREDIT[status],
    weight: weightOf(req),
    risk: riskFor(req, status),
    evidence,
    matchedSpecifics,
    missingSpecifics,
    negationDetected,
    hedgingDetected,
    issue: issueFor(req, status, missingSpecifics, negationDetected, hedgingDetected),
  };
}

function analyzeConcepts(text: string, sentences: string[]): ConceptFinding[] {
  return CONCEPTS.map((concept) => {
    let frequency = 0;
    for (const pattern of concept.patterns) {
      const re = new RegExp(pattern.source, pattern.flags.includes('g') ? pattern.flags : `${pattern.flags}g`);
      frequency += (text.match(re) ?? []).length;
    }

    const sample = sentences.find((s) =>
      concept.patterns.some((p) => new RegExp(p.source, p.flags.replace('g', '')).test(s)),
    );

    const ratio = frequency / concept.strongAt;
    // Saturating curve: the 1st and 2nd hits move confidence far more than the 20th.
    const confidence = frequency === 0 ? 0 : clamp(0.42 + 0.5 * (1 - Math.exp(-1.15 * ratio)), 0, 0.98);

    const detected: ConceptFinding['detected'] =
      frequency === 0 ? 'no' : confidence >= 0.72 ? 'yes' : 'weak';

    return {
      id: concept.id,
      label: concept.label,
      description: concept.description,
      frequency,
      confidence,
      detected,
      sampleSentence: sample,
    };
  }).sort((a, b) => b.confidence - a.confidence || b.frequency - a.frequency);
}

function scoreCategories(findings: RequirementFinding[]): CategoryScore[] {
  return CATEGORIES.map((category) => {
    const inCategory = findings.filter(
      (f) => f.requirement.category === category.id && f.status !== 'not_applicable',
    );
    const possible = inCategory.reduce((sum, f) => sum + f.weight, 0);
    const earned = inCategory.reduce((sum, f) => sum + f.weight * f.credit, 0);
    return {
      id: category.id,
      label: category.label,
      score: possible ? Math.round((earned / possible) * 100) : 100,
      earned,
      possible,
      requirements: inCategory.length,
    };
  }).filter((c) => c.requirements > 0);
}

function collectRisks(findings: RequirementFinding[]): RiskItem[] {
  const order: RiskLevel[] = ['critical', 'high', 'medium', 'low'];
  return findings
    .filter((f) => f.risk !== 'none')
    .map((f) => ({
      level: f.risk,
      title: f.requirement.title,
      detail: f.issue,
      requirementId: f.requirement.id,
    }))
    .sort((a, b) => order.indexOf(a.level) - order.indexOf(b.level));
}

function overallRisk(score: number, findings: RequirementFinding[]): RiskLevel {
  const criticals = findings.filter((f) => f.risk === 'critical').length;
  if (criticals >= 3 || score < 40) return 'critical';
  if (criticals >= 1 || score < 60) return 'high';
  if (score < 80) return 'medium';
  return 'low';
}

function verdictFor(score: number): string {
  if (score >= 85) return 'COMPLIANT';
  if (score >= 60) return 'PARTIALLY COMPLIANT';
  if (score >= 35) return 'NON-COMPLIANT';
  return 'CRITICALLY NON-COMPLIANT';
}

export interface AnalyzeInput {
  text: string;
  fileName: string;
  fileSize: number;
  fileType: string;
  pages: number;
  extractionRate: number;
  durationMs: number;
}

/**
 * Runs the full pipeline over extracted policy text.
 *
 * Score = (Σ weight[matched] / Σ weight[applicable]) × 100 — the weighted
 * formula from the project proposal, with mandatory = 3, conditional = 2 and
 * recommended = 1, and partial matches credited at half weight.
 */
export function runAnalysis(input: AnalyzeInput): ScanResult {
  const text = input.text;
  const sentences = splitSentences(text);
  const paragraphs = splitParagraphs(text);
  const sections = detectSections(text);
  const words = countWords(text);

  const findings = REQUIREMENTS.map((req) => analyzeRequirement(req, sentences, text));
  const applicable = findings.filter((f) => f.status !== 'not_applicable');

  const applicableWeight = applicable.reduce((sum, f) => sum + f.weight, 0);
  const earnedWeight = applicable.reduce((sum, f) => sum + f.weight * f.credit, 0);
  const score = applicableWeight ? Math.round((earnedWeight / applicableWeight) * 100) : 0;

  const categories = scoreCategories(findings);
  const risks = collectRisks(findings);

  const stats: DocumentStats = {
    fileName: input.fileName,
    fileSize: input.fileSize,
    fileType: input.fileType,
    pages: input.pages,
    words,
    characters: text.length,
    sentences: sentences.length,
    sections: sections.length,
    paragraphs: paragraphs.length,
    extractionRate: input.extractionRate,
    readingMinutes: Math.max(1, Math.round(words / 220)),
  };

  return {
    id: shortId(),
    createdAt: new Date().toISOString(),
    durationMs: input.durationMs,
    stats,
    text,
    findings,
    concepts: analyzeConcepts(text, sentences),
    categories,
    risks,
    score,
    riskLevel: overallRisk(score, findings),
    verdict: verdictFor(score),
    totals: {
      checked: applicable.length,
      compliant: findings.filter((f) => f.status === 'compliant').length,
      partial: findings.filter((f) => f.status === 'partial').length,
      nonCompliant: findings.filter((f) => f.status === 'non_compliant').length,
      notDetected: findings.filter((f) => f.status === 'not_detected').length,
      notApplicable: findings.filter((f) => f.status === 'not_applicable').length,
      earnedWeight,
      applicableWeight,
    },
  };
}
