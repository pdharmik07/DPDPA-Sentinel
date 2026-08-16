/**
 * Deterministic engine tests.
 *
 * These run without a database and without the NLP service — that isolation is
 * the point: the compliance decision must be reproducible from the rule pack
 * and the document text alone.
 */

import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { analyzeText } from '../src/engine/analyze.js';
import { loadRulePack } from '../src/engine/rulePack.js';
import { scoreFindings, verdictFor } from '../src/engine/scoring.js';
import { assessRisk } from '../src/engine/risk.js';
import { buildRecommendations, priorityFor } from '../src/engine/recommendation.js';
import { hasHedging, hasNegation, prepareDocument } from '../src/engine/text.js';
import { POINTS, type Finding, type NlpAnalysis } from '../src/engine/types.js';
import { safeDisplayName, resolveWithin, extensionOf } from '../src/middleware/upload.js';

const FIXTURES = path.resolve(__dirname, 'fixtures');
const SAMPLES = path.resolve(__dirname, '../../samples');

const read = (dir: string, name: string) => readFileSync(path.join(dir, name), 'utf8');

const POLICIES = {
  compliant: () => read(SAMPLES, '01-strong-fintech-policy.txt'),
  nonCompliant: () => read(SAMPLES, '02-weak-startup-notice.txt'),
  partial: () => read(SAMPLES, '03-medium-edtech-policy.md'),
  children: () => read(FIXTURES, 'children-service.txt'),
  ecommerce: () => read(FIXTURES, 'ecommerce.txt'),
  international: () => read(FIXTURES, 'international.txt'),
};

// ── Rule pack integrity ─────────────────────────────────────────────────────

describe('rule pack', () => {
  const pack = loadRulePack();

  it('loads the design document rule set plus the supplementary rules', () => {
    expect(pack.rules).toHaveLength(41);
    expect(pack.rules.filter((r) => r.category !== 'additional')).toHaveLength(37);
    expect(pack.manifest.categories).toHaveLength(16);
  });

  it('gives every rule a compilable anchor and a legal basis', () => {
    for (const rule of pack.rules) {
      expect(rule.compiled.anchors.length, `${rule.ruleId} anchors`).toBeGreaterThan(0);
      expect(rule.legalBasis ?? rule.actSection, `${rule.ruleId} legal basis`).toBeTruthy();
      expect(rule.recommendation.length).toBeGreaterThan(10);
    }
  });

  it('never presents a project-specific check as a statutory requirement', () => {
    for (const rule of pack.rules) {
      if (rule.sourceType === 'PROJECT_SPECIFIC' || rule.sourceType === 'BEST_PRACTICE') {
        expect(rule.actSection, `${rule.ruleId} must not cite an Act section`).toBeNull();
      }
    }
  });

  it('carries the phased commencement dates from the DPDP Rules 2025', () => {
    // Rule 4 (Consent Manager registration) is the one-year tranche...
    const consentManager = pack.byId.get('C5');
    expect(consentManager?.ruleReference).toContain('Rule 4');
    expect(consentManager?.effectiveFrom).toBe('2026-11-13');

    // ...the rest of the operative rules are the eighteen-month tranche.
    const breach = pack.byId.get('B2');
    expect(breach?.effectiveFrom).toBe('2027-05-13');
    expect(breach?.effectiveNote).toContain('2027-05-13');
  });

  it('populates effectiveFrom for every rule that cites a Rules 2025 provision', () => {
    // Keying this off sourceType instead of the citation left it null on all 41
    // rules, which silently disabled the commencement display.
    const withRuleRef = pack.rules.filter((r) => r.ruleReference);
    expect(withRuleRef.length).toBeGreaterThan(20);
    for (const rule of withRuleRef) {
      expect(rule.effectiveFrom, `${rule.ruleId} cites ${rule.ruleReference}`).toBeTruthy();
    }
    // Act-sourced rules with no Rules-2025 citation stay null and say why:
    // the Act's own commencement under s.1(2) is not established by the sources.
    for (const rule of pack.rules.filter((r) => !r.ruleReference && r.sourceType === 'ACT')) {
      expect(rule.effectiveFrom).toBeNull();
      expect(rule.effectiveNote, rule.ruleId).toContain('Requires verification');
    }

    // Project-specific checks are not statutory, so they carry no commencement
    // date and no Act caveat — only an explanation of what they are.
    for (const rule of pack.rules.filter((r) => r.sourceType === 'PROJECT_SPECIFIC')) {
      expect(rule.effectiveFrom).toBeNull();
      expect(rule.actSection).toBeNull();
      expect(rule.effectiveNote, rule.ruleId).toBeTruthy();
    }
  });

  it('records the citation corrections made against the supplied sources', () => {
    expect(pack.manifest.provenance.citationCorrections).toEqual(
      expect.arrayContaining(['N5', 'D1', 'AX2']),
    );
  });
});

// ── Scoring model (from the Rule Engine Design Document) ────────────────────

describe('scoring model', () => {
  it('uses the design document point table exactly', () => {
    expect(POINTS.MANDATORY).toEqual({ PASS: 3, PARTIAL: 1, FAIL: 0 });
    expect(POINTS.CONDITIONAL).toEqual({ PASS: 2, PARTIAL: 1, FAIL: 0 });
    expect(POINTS.RECOMMENDED).toEqual({ PASS: 1, PARTIAL: 0.5, FAIL: 0 });
  });

  it('credits a partial mandatory rule at 1 point, not half of 3', () => {
    // This is the specific divergence from the previous browser engine.
    expect(POINTS.MANDATORY.PARTIAL).toBe(1);
    expect(POINTS.MANDATORY.PARTIAL).not.toBe(1.5);
  });

  it('excludes NOT_APPLICABLE rules from both numerator and denominator', () => {
    const pack = loadRulePack();
    const categories = pack.manifest.categories.filter((c) => c.id === 'security');
    const rules = pack.rules.filter((r) => r.category === 'security');

    const base = rules.map((r) => stubFinding(r.ruleId, 'PASS', r.weightClass, r.category));
    const withNA = [
      ...base,
      stubFinding('X-NA', 'NOT_APPLICABLE', 'MANDATORY', 'security'),
    ];

    const a = scoreFindings(base, categories);
    const b = scoreFindings(withNA, categories);

    expect(b.overallScore).toBe(a.overallScore);
    expect(b.maxPoints).toBe(a.maxPoints);
    expect(b.notApplicableCount).toBe(1);
  });

  it('drops a category from the average when nothing in it applies', () => {
    const pack = loadRulePack();
    const categories = pack.manifest.categories.filter((c) => c.id === 'children' || c.id === 'security');
    const findings = [
      stubFinding('S1', 'PASS', 'MANDATORY', 'security'),
      stubFinding('K1', 'NOT_APPLICABLE', 'CONDITIONAL', 'children'),
    ];
    const result = scoreFindings(findings, categories);
    expect(result.categoryScores.map((c) => c.id)).toEqual(['security']);
    expect(result.overallScore).toBe(100);
  });

  it('never labels a result as legally compliant', () => {
    for (const score of [0, 34, 59, 84, 100]) {
      expect(verdictFor(score).toLowerCase()).not.toContain('compliant');
    }
  });
});

// ── Negation and hedging ────────────────────────────────────────────────────

describe('negation handling', () => {
  it('treats an explicit denial as evidence against the requirement', () => {
    expect(hasNegation('We do not provide users with a mechanism to withdraw consent.')).toBe(true);
  });

  it('does not treat a prohibition commitment as a denial', () => {
    // These are the strongest possible clauses; punishing them was a real bug.
    expect(hasNegation('We do not sell your personal data to third parties.')).toBe(false);
    expect(hasNegation('We do not undertake any tracking or behavioural monitoring of children.')).toBe(false);
    expect(hasNegation('We do not bundle unrelated purposes into a single consent request.')).toBe(false);
    expect(hasNegation('We do not knowingly collect data from children.')).toBe(false);
    expect(hasNegation('Nothing is pre-selected.')).toBe(false);
  });

  it("hedges only the fiduciary's discretion, not a right granted to the user", () => {
    expect(hasHedging('We may retain your data for as long as we deem necessary.')).toBe(true);
    expect(hasHedging('We will delete data where feasible.')).toBe(true);
    // "You may withdraw" grants a right — it must not be read as a hedge.
    expect(hasHedging('You may withdraw your consent at any time.')).toBe(false);
  });

  it('fails a requirement the policy only denies', () => {
    // The example from the specification: a denial must never satisfy the rule.
    const denial = `${POLICIES.ecommerce()}

CONSENT WITHDRAWAL
We do not provide users with a mechanism to withdraw consent. Consent cannot be withdrawn once
given, and no facility exists for this purpose.`;

    const result = analyzeText(denial);
    const withdrawal = result.findings.find((f) => f.ruleId === 'C4');
    expect(withdrawal?.status).toBe('FAIL');
    expect(withdrawal?.negationDetected).toBe(true);
  });

  it('caps a self-contradictory policy at PARTIAL rather than passing it', () => {
    // A policy that both grants and denies withdrawal is ambiguous. The
    // favourable clause must not be allowed to carry it to a PASS.
    const mixed = `${POLICIES.compliant()}

CONSENT WITHDRAWAL ADDENDUM
We do not provide users with a mechanism to withdraw consent. Consent cannot be withdrawn once
given, and no facility exists for this purpose.`;

    const withdrawal = analyzeText(mixed).findings.find((f) => f.ruleId === 'C4');
    expect(withdrawal?.status).toBe('PARTIAL');
    expect(withdrawal?.reasoning).toMatch(/both asserts and denies/i);
  });
});

// ── The core invariant: NLP assists, rules decide ───────────────────────────

describe('semantic similarity is advisory only', () => {
  /** Maximum-strength fake NLP signal for every rule. */
  function saturatedNlp(indices: number[]): NlpAnalysis {
    const pack = loadRulePack();
    const byRule: NlpAnalysis['byRule'] = {};
    for (const rule of pack.rules) {
      byRule[rule.ruleId] = {
        ruleId: rule.ruleId,
        bestSimilarity: 1,
        sentences: indices.map((index) => ({ index, similarity: 1, negated: false })),
      };
    }
    return { available: true, model: 'test-stub', byRule };
  }

  const vague =
    'This document is about our approach to information. ' +
    'We think privacy matters a great deal to everyone involved in our organisation. ' +
    'Our team cares about doing the right thing with respect to data and people. ' +
    'We aim to be a responsible business in every market where we operate today.';

  it('cannot turn a document with no real clauses into passes', () => {
    const doc = prepareDocument(vague);
    const indices = doc.sentences.map((s) => s.index);
    const result = analyzeText(vague, { nlp: saturatedNlp(indices) });

    // A perfect similarity score on every rule must still not manufacture a PASS,
    // because PASS additionally requires a non-negated anchor match and at least
    // half the rule's specific sub-elements.
    expect(result.score.passedCount).toBe(0);
  });

  it('recognises a semantic paraphrase without letting it decide the outcome', () => {
    const paraphrase =
      'Users may revoke permission for processing from account settings at any time. ' +
      'The process for revoking permission is the same as the process for granting it.';
    const doc = prepareDocument(paraphrase);
    const indices = doc.sentences.map((s) => s.index);

    const withNlp = analyzeText(paraphrase, { nlp: saturatedNlp(indices) });
    const withoutNlp = analyzeText(paraphrase);

    const a = withNlp.findings.find((f) => f.ruleId === 'C4');
    const b = withoutNlp.findings.find((f) => f.ruleId === 'C4');

    // The semantic layer raises confidence and marks its support...
    expect(a!.confidence).toBeGreaterThan(b!.confidence);
    expect(a!.semanticSupport).toBe(true);
    // ...but it is never the thing that decides a PASS.
    expect(a!.status).not.toBe('PASS');
  });
});

// ── Applicability ───────────────────────────────────────────────────────────

describe('applicability engine', () => {
  it('marks live-scan rules not applicable and explains why', () => {
    const result = analyzeText(POLICIES.compliant());
    for (const ruleId of ['BC1', 'BC2']) {
      const finding = result.findings.find((f) => f.ruleId === ruleId);
      expect(finding?.status).toBe('NOT_APPLICABLE');
      expect(finding?.applicabilityReason).toMatch(/live website/i);
    }
  });

  it("applies children's rules to a children's service", () => {
    const result = analyzeText(POLICIES.children());
    const k2 = result.findings.find((f) => f.ruleId === 'K2');
    expect(k2?.applicable).toBe(true);
    expect(k2?.status).toBe('PASS');
  });

  it('applies cross-border and SDF rules to an international policy', () => {
    const result = analyzeText(POLICIES.international());
    expect(result.findings.find((f) => f.ruleId === 'X1')?.applicable).toBe(true);
    expect(result.findings.find((f) => f.ruleId === 'SDF1')?.applicable).toBe(true);
  });

  it('records an applicability reason for every excluded rule', () => {
    const result = analyzeText(POLICIES.ecommerce());
    for (const finding of result.findings.filter((f) => f.status === 'NOT_APPLICABLE')) {
      expect(finding.applicabilityReason, `${finding.ruleId}`).toBeTruthy();
      expect(finding.points).toBe(0);
    }
  });
});

// ── End-to-end corpus behaviour ─────────────────────────────────────────────

describe('assessment corpus', () => {
  it('ranks the corpus in the expected order', () => {
    const strong = analyzeText(POLICIES.compliant()).score.overallScore;
    const partial = analyzeText(POLICIES.partial()).score.overallScore;
    const weak = analyzeText(POLICIES.nonCompliant()).score.overallScore;

    expect(strong).toBeGreaterThan(partial);
    expect(partial).toBeGreaterThan(weak);
    expect(strong).toBeGreaterThan(80);
    expect(weak).toBeLessThan(30);
  });

  it('flags the e-commerce policy for implied consent', () => {
    const result = analyzeText(POLICIES.ecommerce());
    // "By continuing to use the site you agree" is a direct contradiction of the
    // clear-affirmative-action requirement.
    expect(result.findings.find((f) => f.ruleId === 'C2')?.status).toBe('FAIL');
  });

  it('produces evidence for every non-applicable-free finding it passes', () => {
    const result = analyzeText(POLICIES.international());
    for (const finding of result.findings.filter((f) => f.status === 'PASS')) {
      expect(finding.evidence.length, `${finding.ruleId} must cite evidence`).toBeGreaterThan(0);
      expect(finding.reasoning.length).toBeGreaterThan(10);
      expect(finding.legalReference.length).toBeGreaterThan(3);
    }
  });

  it('is deterministic across repeated runs', () => {
    const text = POLICIES.partial();
    const a = analyzeText(text);
    const b = analyzeText(text);
    expect(JSON.stringify(b.findings.map((f) => [f.ruleId, f.status, f.points, f.confidence]))).toBe(
      JSON.stringify(a.findings.map((f) => [f.ruleId, f.status, f.points, f.confidence])),
    );
    expect(b.score.overallScore).toBe(a.score.overallScore);
    expect(b.risk.level).toBe(a.risk.level);
  });
});

// ── Risk ────────────────────────────────────────────────────────────────────

describe('risk engine', () => {
  it('does not derive risk from the score alone', () => {
    const result = analyzeText(POLICIES.compliant());
    // Same score, but inject a breach failure: the level must rise.
    const withBreachFailure = result.findings.map((f) =>
      f.ruleId === 'B1' ? { ...f, status: 'FAIL' as const, points: 0 } : f,
    );
    const risk = assessRisk(withBreachFailure, result.score);
    expect(['HIGH', 'CRITICAL']).toContain(risk.level);
    expect(risk.explanation).toMatch(/breach|factor/i);
  });

  it('records every factor with its trigger state for auditability', () => {
    const result = analyzeText(POLICIES.nonCompliant());
    expect(result.risk.factors.length).toBeGreaterThan(5);
    for (const factor of result.risk.factors) {
      expect(typeof factor.triggered).toBe('boolean');
      expect(factor.detail.length).toBeGreaterThan(0);
    }
    expect(result.risk.level).toBe('CRITICAL');
  });

  it('rates a strong policy as low risk', () => {
    expect(analyzeText(POLICIES.compliant()).risk.level).toBe('LOW');
  });
});

// ── Recommendations ─────────────────────────────────────────────────────────

describe('recommendation engine', () => {
  it('raises an item for every failure, ordered by priority', () => {
    const result = analyzeText(POLICIES.nonCompliant());
    const failures = result.findings.filter((f) => f.status === 'FAIL' && f.applicable);
    for (const failure of failures) {
      expect(
        result.recommendations.some((r) => r.ruleId === failure.ruleId),
        `${failure.ruleId} must have a recommendation`,
      ).toBe(true);
    }
    const order = { CRITICAL: 0, HIGH: 1, MEDIUM: 2, LOW: 3 };
    const priorities = result.recommendations.map((r) => order[r.priority]);
    expect([...priorities].sort((a, b) => a - b)).toEqual(priorities);
  });

  it('ranks a failed critical mandatory rule as CRITICAL priority', () => {
    const finding = stubFinding('B1', 'FAIL', 'MANDATORY', 'breach', 'CRITICAL');
    expect(priorityFor(finding)).toBe('CRITICAL');
  });

  it('never asserts a legal obligation for a project-specific check', () => {
    const result = analyzeText(POLICIES.ecommerce());
    for (const rec of result.recommendations) {
      if (rec.sourceType === 'PROJECT_SPECIFIC' || rec.sourceType === 'BEST_PRACTICE') {
        expect(rec.legalReference).not.toMatch(/DPDPA 2023, Section/);
      }
    }
  });

  it('produces no recommendation for a clean pass', () => {
    const findings = [stubFinding('S1', 'PASS', 'MANDATORY', 'security')];
    expect(buildRecommendations(findings)).toHaveLength(0);
  });
});

// ── Upload hardening ────────────────────────────────────────────────────────

describe('upload safety', () => {
  it('strips directory components from an uploaded filename', () => {
    expect(safeDisplayName('../../etc/passwd')).toBe('passwd');
    expect(safeDisplayName('C:\\Windows\\System32\\evil.txt')).toBe('evil.txt');
    expect(safeDisplayName('....//....//secret.pdf')).not.toContain('/');
  });

  it('never returns an empty display name', () => {
    expect(safeDisplayName('')).toBe('uploaded-document');
    expect(safeDisplayName('///')).toBe('uploaded-document');
  });

  it('refuses a path that escapes its root', () => {
    expect(() => resolveWithin('/srv/reports', '../../etc/passwd')).toThrow();
    expect(() => resolveWithin('/srv/reports', 'ok.pdf')).not.toThrow();
  });

  it('reads the extension from the basename only', () => {
    expect(extensionOf('policy.PDF')).toBe('.pdf');
    expect(extensionOf('archive.tar.gz')).toBe('.gz');
    expect(extensionOf('noextension')).toBe('');
  });
});

// ── Helper ──────────────────────────────────────────────────────────────────

function stubFinding(
  ruleId: string,
  status: Finding['status'],
  weightClass: 'MANDATORY' | 'CONDITIONAL' | 'RECOMMENDED',
  category: string,
  severity: Finding['severity'] = 'HIGH',
): Finding {
  const maxPoints = { MANDATORY: 3, CONDITIONAL: 2, RECOMMENDED: 1 }[weightClass];
  const points = status === 'NOT_APPLICABLE' ? 0 : POINTS[weightClass][status];
  return {
    ruleId,
    rule: {
      ruleId,
      category,
      categoryLabel: category,
      title: `Stub ${ruleId}`,
      description: 'stub',
      requirement: 'stub',
      sourceType: 'ACT',
      legalBasis: 'DPDPA 2023',
      actSection: 'Section 8',
      ruleReference: null,
      scheduleReference: null,
      sourceUrl: null,
      ruleVersion: '1.0.0',
      legalVersion: 'test',
      effectiveFrom: null,
      effectiveTo: null,
      effectiveNote: null,
      weightClass,
      weight: maxPoints,
      severity,
      applicability: 'ALWAYS',
      detection: {
        anchors: [],
        supporting: [],
        specifics: [],
        applicabilityTriggers: [],
        negativeIndicators: [],
        semanticConcepts: [],
        portedFrom: null,
      },
      recommendation: 'stub recommendation',
      remediation: 'stub remediation',
      suggestedLanguage: null,
    },
    status,
    applicable: status !== 'NOT_APPLICABLE',
    applicabilityReason: null,
    confidence: status === 'PASS' ? 0.9 : 0.2,
    credit: maxPoints ? points / maxPoints : 0,
    points,
    maxPoints,
    evidence: [],
    matchedSpecifics: [],
    missingSpecifics: [],
    negationDetected: false,
    hedgingDetected: false,
    semanticSupport: false,
    reasoning: 'stub',
    legalReference: 'DPDPA 2023, Section 8',
    severity,
  };
}
