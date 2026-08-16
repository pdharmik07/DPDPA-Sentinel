/**
 * Risk engine.
 *
 * Risk is deliberately NOT a function of the compliance score alone. A policy
 * can score respectably overall while failing the one obligation that carries
 * the largest real-world exposure — an absent breach-notification clause, or
 * children's data processed without verifiable parental consent.
 *
 * Every factor is recorded with its trigger state and contribution, so the
 * assigned level can be explained and audited rather than merely asserted.
 */

import type { Finding, RiskFactor, RiskResult, ScoreResult } from './types.js';

/** Points at which the aggregate risk score crosses into each level. */
const THRESHOLDS: { level: RiskResult['level']; min: number }[] = [
  { level: 'CRITICAL', min: 8 },
  { level: 'HIGH', min: 5 },
  { level: 'MEDIUM', min: 2 },
  { level: 'LOW', min: 0 },
];

function failedIn(findings: Finding[], category: string): Finding[] {
  return findings.filter((f) => f.rule.category === category && f.status === 'FAIL' && f.applicable);
}

export function assessRisk(findings: Finding[], score: ScoreResult): RiskResult {
  const applicable = findings.filter((f) => f.status !== 'NOT_APPLICABLE');
  const failed = applicable.filter((f) => f.status === 'FAIL');
  const failedMandatory = failed.filter((f) => f.rule.weightClass === 'MANDATORY');
  const criticalFailed = failed.filter((f) => f.severity === 'CRITICAL');
  const highFailed = failed.filter((f) => f.severity === 'HIGH');

  const securityFails = failedIn(findings, 'security');
  const breachFails = failedIn(findings, 'breach');
  const childrenFails = failedIn(findings, 'children');
  const sdfFails = failedIn(findings, 'sdf');
  const rightsFails = failedIn(findings, 'rights');
  const grievanceFails = failedIn(findings, 'grievance');
  const consentFails = failedIn(findings, 'consent');

  const factors: RiskFactor[] = [
    {
      code: 'SCORE_CRITICAL',
      label: 'Overall alignment score below 40',
      detail: `Overall score is ${score.overallScore}.`,
      triggered: score.overallScore < 40,
      weight: 4,
    },
    {
      code: 'SCORE_LOW',
      label: 'Overall alignment score between 40 and 59',
      detail: `Overall score is ${score.overallScore}.`,
      triggered: score.overallScore >= 40 && score.overallScore < 60,
      weight: 2,
    },
    {
      code: 'SCORE_MODERATE',
      label: 'Overall alignment score between 60 and 79',
      detail: `Overall score is ${score.overallScore}.`,
      triggered: score.overallScore >= 60 && score.overallScore < 80,
      weight: 1,
    },
    {
      code: 'MANDATORY_FAILURES_MANY',
      label: 'Three or more mandatory requirements failed',
      detail: `${failedMandatory.length} mandatory requirement(s) failed: ${idList(failedMandatory)}.`,
      triggered: failedMandatory.length >= 3,
      weight: 3,
    },
    {
      // Mutually exclusive with MANDATORY_FAILURES_MANY — the two bands must
      // not both fire for the same failures, or three failures would be counted
      // twice and push an otherwise sound policy straight to CRITICAL.
      code: 'MANDATORY_FAILURES_SOME',
      label: 'One or two mandatory requirements failed',
      detail: `${failedMandatory.length} mandatory requirement(s) failed${failedMandatory.length ? `: ${idList(failedMandatory)}` : ''}.`,
      triggered: failedMandatory.length >= 1 && failedMandatory.length < 3,
      weight: 2,
    },
    {
      code: 'CRITICAL_SEVERITY_FAILURE',
      label: 'A requirement rated critical severity failed',
      detail: criticalFailed.length
        ? `Critical-severity failures: ${idList(criticalFailed)}.`
        : 'No critical-severity failures.',
      triggered: criticalFailed.length > 0,
      weight: 3,
    },
    {
      code: 'SECURITY_FAILURE',
      label: 'Security safeguards requirement failed',
      detail: securityFails.length
        ? `Section 8(4)-(5) / Rule 6 safeguards not evidenced: ${idList(securityFails)}.`
        : 'Security safeguards evidenced.',
      triggered: securityFails.length > 0,
      weight: 2,
    },
    {
      code: 'BREACH_FAILURE',
      label: 'Breach notification requirement failed',
      detail: breachFails.length
        ? `Section 8(6) / Rule 7 breach obligations not evidenced: ${idList(breachFails)}.`
        : 'Breach notification evidenced.',
      triggered: breachFails.length > 0,
      weight: 2,
    },
    {
      code: 'CHILDREN_FAILURE',
      label: "Children's data requirement failed where the obligation applies",
      detail: childrenFails.length
        ? `Section 9 obligations apply but are not evidenced: ${idList(childrenFails)}.`
        : "Children's data obligations either do not apply or are evidenced.",
      triggered: childrenFails.length > 0,
      weight: 3,
    },
    {
      code: 'SDF_FAILURE',
      label: 'Significant Data Fiduciary obligation failed where it applies',
      detail: sdfFails.length
        ? `Section 10 / Rule 13 obligations apply but are not evidenced: ${idList(sdfFails)}.`
        : 'SDF obligations either do not apply or are evidenced.',
      triggered: sdfFails.length > 0,
      weight: 2,
    },
    {
      code: 'CONSENT_FAILURE',
      label: 'Consent validity requirement failed',
      detail: consentFails.length ? `Consent failures: ${idList(consentFails)}.` : 'Consent requirements evidenced.',
      triggered: consentFails.length > 0,
      weight: 2,
    },
    {
      code: 'RIGHTS_FAILURE',
      label: 'Data Principal rights requirement failed',
      detail: rightsFails.length ? `Rights failures: ${idList(rightsFails)}.` : 'Rights requirements evidenced.',
      triggered: rightsFails.length > 0,
      weight: 1,
    },
    {
      code: 'GRIEVANCE_FAILURE',
      label: 'Grievance redressal requirement failed',
      detail: grievanceFails.length
        ? `Grievance failures: ${idList(grievanceFails)}.`
        : 'Grievance redressal evidenced.',
      triggered: grievanceFails.length > 0,
      weight: 1,
    },
    {
      code: 'MANY_HIGH_RISK_FINDINGS',
      label: 'Five or more high or critical severity findings failed',
      detail: `${criticalFailed.length + highFailed.length} high/critical severity failure(s).`,
      triggered: criticalFailed.length + highFailed.length >= 5,
      weight: 2,
    },
  ];

  const points = factors.reduce((sum, f) => (f.triggered ? sum + f.weight : sum), 0);
  let level = THRESHOLDS.find((t) => points >= t.min)?.level ?? 'LOW';

  // Hard floors — these exposures cannot be averaged away by a good score
  // elsewhere in the policy.
  const floors: { when: boolean; floor: RiskResult['level']; why: string }[] = [
    { when: childrenFails.length > 0, floor: 'HIGH', why: "an applicable children's-data obligation failed" },
    { when: breachFails.length > 0, floor: 'HIGH', why: 'the breach-notification obligation failed' },
    { when: securityFails.length > 0, floor: 'HIGH', why: 'the security-safeguards obligation failed' },
  ];
  const appliedFloors: string[] = [];
  for (const f of floors) {
    if (f.when && rank(level) < rank(f.floor)) {
      level = f.floor;
      appliedFloors.push(f.why);
    } else if (f.when) {
      appliedFloors.push(f.why);
    }
  }

  const triggered = factors.filter((f) => f.triggered);
  const explanation = buildExplanation(level, points, triggered, appliedFloors, score);

  return {
    level,
    explanation,
    factors,
    criticalFindings: criticalFailed.length,
    highFindings: highFailed.length,
  };
}

function rank(level: RiskResult['level']): number {
  return { LOW: 0, MEDIUM: 1, HIGH: 2, CRITICAL: 3 }[level];
}

function idList(findings: Finding[]): string {
  return findings.map((f) => f.ruleId).join(', ');
}

function buildExplanation(
  level: RiskResult['level'],
  points: number,
  triggered: RiskFactor[],
  floors: string[],
  score: ScoreResult,
): string {
  if (triggered.length === 0) {
    return `Risk assessed as ${level}. No elevating risk factors were triggered; the overall alignment score is ${score.overallScore}.`;
  }

  const top = triggered
    .slice()
    .sort((a, b) => b.weight - a.weight)
    .slice(0, 4)
    .map((f) => f.label.toLowerCase());

  const floorNote = floors.length
    ? ` A minimum risk level was applied because ${joinWords(floors)}.`
    : '';

  return (
    `Risk assessed as ${level} from an aggregate risk score of ${points} across ${triggered.length} triggered factor(s). ` +
    `The largest contributors were: ${joinWords(top)}.${floorNote} ` +
    `Risk is derived from the pattern of failures and their severity, not from the compliance score alone.`
  );
}

function joinWords(items: string[]): string {
  if (items.length === 0) return '';
  if (items.length === 1) return items[0] ?? '';
  return `${items.slice(0, -1).join(', ')} and ${items[items.length - 1]}`;
}
