/**
 * Recommendation engine.
 *
 * Produces a remediation item for every failed rule and every partial rule that
 * still has a gap. Each item carries the legal reference and the source type,
 * so the UI can always show whether the user is being told about a statutory
 * requirement or a recommended practice. Nothing here invents an obligation:
 * the text comes from the rule pack, and the issue text comes from the
 * engine's own reasoning about the evidence.
 */

import type { Finding, Priority, Recommendation } from './types.js';

const PRIORITY_ORDER: Record<Priority, number> = { CRITICAL: 0, HIGH: 1, MEDIUM: 2, LOW: 3 };

export function priorityFor(finding: Finding): Priority {
  const { status, severity } = finding;
  const cls = finding.rule.weightClass;

  if (status === 'FAIL') {
    if (cls === 'MANDATORY') return severity === 'CRITICAL' ? 'CRITICAL' : 'HIGH';
    if (cls === 'CONDITIONAL') return severity === 'CRITICAL' || severity === 'HIGH' ? 'HIGH' : 'MEDIUM';
    return severity === 'MEDIUM' ? 'MEDIUM' : 'LOW';
  }

  // PARTIAL — the obligation is addressed but incompletely, so it ranks one
  // step below the equivalent outright failure.
  if (cls === 'MANDATORY') return severity === 'CRITICAL' ? 'HIGH' : 'MEDIUM';
  if (cls === 'CONDITIONAL') return 'MEDIUM';
  return 'LOW';
}

function issueFor(finding: Finding): string {
  if (finding.status === 'FAIL') {
    return finding.negationDetected
      ? `${finding.rule.title} is addressed but expressly denied or declined.`
      : `${finding.rule.title} is not established by the policy.`;
  }
  const gaps = finding.missingSpecifics.length
    ? ` Missing element(s): ${finding.missingSpecifics.join('; ').toLowerCase()}.`
    : '';
  return `${finding.rule.title} is only partially satisfied.${gaps}`;
}

export function buildRecommendations(findings: Finding[]): Recommendation[] {
  const actionable = findings.filter(
    (f) =>
      f.applicable &&
      (f.status === 'FAIL' ||
        // A partial with no missing sub-element and no hedging has nothing
        // concrete left to fix, so it is not raised as a remediation item.
        (f.status === 'PARTIAL' && (f.missingSpecifics.length > 0 || f.hedgingDetected))),
  );

  return actionable
    .map<Recommendation>((f) => ({
      ruleId: f.ruleId,
      title: f.rule.title,
      category: f.rule.category,
      categoryLabel: f.rule.categoryLabel,
      issue: issueFor(f),
      explanation: f.reasoning,
      legalReference: f.legalReference,
      sourceType: f.rule.sourceType,
      recommendation: f.rule.recommendation,
      remediation: f.rule.remediation,
      suggestedLanguage: f.rule.suggestedLanguage,
      priority: priorityFor(f),
      status: f.status,
    }))
    .sort(
      (a, b) =>
        PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority] || a.ruleId.localeCompare(b.ruleId),
    );
}
