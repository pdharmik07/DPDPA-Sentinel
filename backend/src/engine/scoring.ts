/**
 * Scoring engine.
 *
 * Implements the model specified in section 5 ("Scoring Logic") of the supplied
 * DPDPA Sentinel Rule Engine Design Document, verbatim:
 *
 *   Points per rule
 *     Mandatory   PASS 3   PARTIAL 1    FAIL 0
 *     Conditional PASS 2   PARTIAL 1    FAIL 0   (N/A: excluded entirely)
 *     Recommended PASS 1   PARTIAL 0.5  FAIL 0
 *
 *   Category score  = (points earned in category / max points for APPLICABLE
 *                      rules in that category) x 100
 *
 *   Overall score   = weighted average of category scores, so that mandatory
 *                     categories count for more than recommended ones.
 *
 * The design document states that mandatory categories must count for more but
 * does not give explicit category weights. This implementation derives each
 * category's weight as the sum of the weights of its APPLICABLE member rules
 * (mandatory 3, conditional 2, recommended 1) — the only non-arbitrary reading.
 * That derivation is documented in docs/RULE_ENGINE.md and marked as derived,
 * not stated, in the rule pack manifest.
 *
 * Note this differs from the previous browser engine, which used a single
 * global weighted ratio and credited a partial mandatory rule at 1.5. The
 * design document is the specified source of truth, so 1 is used here.
 */

import { WEIGHT, type CategoryManifest, type CategoryScore, type Finding, type ScoreResult } from './types.js';

export const SCORING_MODEL = 'design-doc-1.0';

/**
 * Verdict wording is deliberately non-legal. The tool performs an automated
 * preliminary assessment; it must never assert that an organisation is
 * legally compliant.
 */
export function verdictFor(score: number): string {
  if (score >= 85) return 'STRONG ALIGNMENT';
  if (score >= 60) return 'PARTIAL ALIGNMENT';
  if (score >= 35) return 'SIGNIFICANT GAPS';
  return 'CRITICAL GAPS';
}

function round(n: number, dp = 2): number {
  const f = 10 ** dp;
  return Math.round(n * f) / f;
}

export function scoreFindings(findings: Finding[], categories: CategoryManifest[]): ScoreResult {
  const categoryScores: CategoryScore[] = [];

  for (const cat of categories) {
    const inCategory = findings.filter((f) => f.rule.category === cat.id);
    const applicable = inCategory.filter((f) => f.status !== 'NOT_APPLICABLE');

    // A category in which nothing applies drops out of the average entirely,
    // rather than scoring 0 or 100 and skewing the result.
    if (applicable.length === 0) continue;

    const possible = applicable.reduce((sum, f) => sum + f.maxPoints, 0);
    const earned = applicable.reduce((sum, f) => sum + f.points, 0);
    const weight = applicable.reduce((sum, f) => sum + WEIGHT[f.rule.weightClass], 0);

    categoryScores.push({
      id: cat.id,
      label: cat.label,
      order: cat.order,
      score: possible > 0 ? round((earned / possible) * 100) : 0,
      earned: round(earned),
      possible: round(possible),
      rules: applicable.length,
      weight,
      designDocWeight: cat.designDocWeight,
    });
  }

  categoryScores.sort((a, b) => a.order - b.order);

  const totalWeight = categoryScores.reduce((s, c) => s + c.weight, 0);
  const overallScore =
    totalWeight > 0
      ? round(categoryScores.reduce((s, c) => s + c.score * c.weight, 0) / totalWeight, 1)
      : 0;

  const applicableFindings = findings.filter((f) => f.status !== 'NOT_APPLICABLE');

  return {
    overallScore,
    verdict: verdictFor(overallScore),
    scoringModel: SCORING_MODEL,
    earnedPoints: round(applicableFindings.reduce((s, f) => s + f.points, 0)),
    maxPoints: round(applicableFindings.reduce((s, f) => s + f.maxPoints, 0)),
    categoryScores,
    passedCount: findings.filter((f) => f.status === 'PASS').length,
    partialCount: findings.filter((f) => f.status === 'PARTIAL').length,
    failedCount: findings.filter((f) => f.status === 'FAIL').length,
    notApplicableCount: findings.filter((f) => f.status === 'NOT_APPLICABLE').length,
  };
}
