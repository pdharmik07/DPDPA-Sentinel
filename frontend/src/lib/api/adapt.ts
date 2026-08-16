/**
 * Maps backend responses onto the frontend's existing `ScanResult` shape.
 *
 * This adapter is deliberate: it is what lets Results.tsx, charts.tsx,
 * ScoreMeter.tsx and Reports.tsx keep working untouched now that analysis runs
 * on the server. Everything it produces comes from the backend — no value is
 * invented here.
 */

import { analyzeConcepts } from '@/lib/dpdpa/conceptScan';
import { splitSentences } from '@/lib/dpdpa/text';
import type {
  CategoryScore,
  ComplianceStatus,
  ConceptFinding,
  Evidence,
  Requirement,
  RequirementFinding,
  RiskItem,
  RiskLevel,
  ScanResult,
  WeightClass,
} from '@/lib/dpdpa/types';
import type {
  ApiFinding,
  ApiRiskLevel,
  ApiRuleStatus,
  ApiScanDetail,
  ApiSeverity,
  ApiWeightClass,
} from './types';

const WEIGHT_CLASS: Record<ApiWeightClass, WeightClass> = {
  MANDATORY: 'mandatory',
  CONDITIONAL: 'conditional',
  RECOMMENDED: 'recommended',
};

const RISK_LEVEL: Record<ApiRiskLevel, RiskLevel> = {
  LOW: 'low',
  MEDIUM: 'medium',
  HIGH: 'high',
  CRITICAL: 'critical',
};

const SEVERITY_RISK: Record<ApiSeverity, RiskLevel> = {
  LOW: 'low',
  MEDIUM: 'medium',
  HIGH: 'high',
  CRITICAL: 'critical',
};

/**
 * The backend collapses "absent" and "contradicted" into a single FAIL, as the
 * Rule Engine Design Document specifies. The existing UI distinguishes them for
 * display only, so the distinction is recovered from whether any evidence was
 * found in the document.
 */
function toStatus(finding: ApiFinding): ComplianceStatus {
  const map: Record<ApiRuleStatus, ComplianceStatus> = {
    PASS: 'compliant',
    PARTIAL: 'partial',
    FAIL: finding.evidence.length > 0 ? 'non_compliant' : 'not_detected',
    NOT_APPLICABLE: 'not_applicable',
  };
  return map[finding.status];
}

function toRisk(finding: ApiFinding): RiskLevel {
  if (finding.status === 'PASS' || finding.status === 'NOT_APPLICABLE') return 'none';
  const base = SEVERITY_RISK[finding.severity];
  if (finding.status === 'FAIL') return base;
  // A partial is one step less severe than the equivalent outright failure.
  const softened: Record<RiskLevel, RiskLevel> = {
    critical: 'high',
    high: 'medium',
    medium: 'low',
    low: 'low',
    none: 'none',
  };
  return softened[base];
}

function toRequirement(finding: ApiFinding): Requirement {
  const rule = finding.rule;
  return {
    id: rule.ruleId,
    code: rule.ruleId,
    title: rule.title,
    category: rule.category,
    section: finding.legalReference ?? rule.legalBasis ?? '—',
    weightClass: WEIGHT_CLASS[rule.weightClass],
    summary: rule.description,
    whyItMatters: rule.requirement,
    // Detection patterns stay on the server; the UI never needed them.
    anchors: [],
    supporting: [],
    specifics: [],
    recommendation: rule.recommendation,
    suggestedLanguage: rule.suggestedLanguage ?? '',
    sourceType: rule.sourceType,
    effectiveFrom: rule.effectiveFrom,
    effectiveNote: rule.effectiveNote,
  };
}

function toEvidence(finding: ApiFinding): Evidence[] {
  return finding.evidence.map((e) => ({
    sentence: e.sentence,
    index: e.index,
    score: e.score,
    negated: e.negated,
    hedged: e.hedged,
  }));
}

function toFinding(finding: ApiFinding): RequirementFinding {
  const status = toStatus(finding);
  return {
    requirement: toRequirement(finding),
    status,
    confidence: finding.confidence,
    credit: finding.credit,
    weight: finding.maxPoints,
    risk: toRisk(finding),
    evidence: toEvidence(finding),
    matchedSpecifics: finding.matchedSpecifics,
    missingSpecifics: finding.missingSpecifics,
    negationDetected: finding.negationDetected,
    hedgingDetected: finding.hedgingDetected,
    issue:
      status === 'not_applicable'
        ? (finding.applicabilityReason ?? finding.reasoning)
        : finding.reasoning,
  };
}

function toCategories(scan: ApiScanDetail): CategoryScore[] {
  const categories = scan.score?.categoryScores ?? [];
  return categories
    .slice()
    .sort((a, b) => a.order - b.order)
    .map((c) => ({
      id: c.id,
      label: c.label,
      score: c.score,
      earned: c.earned,
      possible: c.possible,
      requirements: c.rules,
    }));
}

function toRisks(findings: RequirementFinding[]): RiskItem[] {
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

/**
 * Privacy-concept panel. The backend does not return this lexicon, so it is
 * computed in the browser from the extracted text the backend sends back —
 * still a real analysis of the real document, not placeholder data.
 */
function toConcepts(text: string): ConceptFinding[] {
  if (!text) return [];
  return analyzeConcepts(text, splitSentences(text));
}

export function adaptScan(scan: ApiScanDetail): ScanResult {
  const findings = scan.findings.map(toFinding);
  const score = scan.score;
  const text = scan.extractedText ?? '';

  const applicable = findings.filter((f) => f.status !== 'not_applicable');

  return {
    id: scan.id,
    createdAt: scan.createdAt,
    durationMs: scan.durationMs ?? 0,
    stats: {
      fileName: scan.fileName,
      fileSize: scan.fileSize,
      fileType: scan.fileType,
      pages: scan.pages ?? 1,
      words: scan.words ?? 0,
      characters: text.length,
      sentences: scan.sentences ?? 0,
      sections: 0,
      paragraphs: scan.paragraphs ?? 0,
      extractionRate: scan.extractionRate ?? 1,
      readingMinutes: Math.max(1, Math.round((scan.words ?? 0) / 220)),
    },
    text,
    findings,
    concepts: toConcepts(text),
    categories: toCategories(scan),
    risks: toRisks(findings),
    score: Math.round(score?.overallScore ?? 0),
    riskLevel: scan.risk ? RISK_LEVEL[scan.risk.level] : 'none',
    verdict: score?.verdict ?? '—',
    totals: {
      checked: applicable.length,
      compliant: score?.passedCount ?? 0,
      partial: score?.partialCount ?? 0,
      nonCompliant: findings.filter((f) => f.status === 'non_compliant').length,
      notDetected: findings.filter((f) => f.status === 'not_detected').length,
      notApplicable: score?.notApplicableCount ?? 0,
      earnedWeight: score?.earnedPoints ?? 0,
      applicableWeight: score?.maxPoints ?? 0,
    },
  };
}
