/** Wire types returned by the DPDPA Sentinel backend. */

export type ApiRuleStatus = 'PASS' | 'PARTIAL' | 'FAIL' | 'NOT_APPLICABLE';
export type ApiWeightClass = 'MANDATORY' | 'CONDITIONAL' | 'RECOMMENDED';
export type ApiSeverity = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
export type ApiPriority = ApiSeverity;
export type ApiRiskLevel = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
export type ApiSourceType = 'ACT' | 'RULES_2025' | 'PROJECT_SPECIFIC' | 'BEST_PRACTICE';
export type ScanStatus = 'QUEUED' | 'PROCESSING' | 'COMPLETED' | 'FAILED';
export type ScanStage =
  | 'UPLOADED'
  | 'EXTRACTING'
  | 'PREPROCESSING'
  | 'ANALYZING'
  | 'EVALUATING_RULES'
  | 'SCORING'
  | 'REPORTING'
  | 'DONE';

export interface ApiUser {
  id: string;
  name: string;
  email: string;
  createdAt: string;
}

export interface AuthResponse {
  user: ApiUser;
  token: string;
}

export interface ApiEvidence {
  sentence: string;
  index: number;
  paragraph: number;
  score: number;
  negated: boolean;
  hedged: boolean;
  semanticScore: number | null;
}

export interface ApiRule {
  ruleId: string;
  category: string;
  categoryLabel: string;
  title: string;
  description: string;
  requirement: string;
  sourceType: ApiSourceType;
  legalBasis: string | null;
  actSection: string | null;
  ruleReference: string | null;
  scheduleReference: string | null;
  legalReference?: string;
  ruleVersion: string;
  legalVersion: string;
  effectiveFrom: string | null;
  effectiveTo: string | null;
  effectiveNote: string | null;
  inForce?: boolean | null;
  effectiveStatus?: 'IN_FORCE' | 'NOT_YET_IN_FORCE' | 'UNKNOWN';
  weightClass: ApiWeightClass;
  weight: number;
  severity: ApiSeverity;
  applicability: 'ALWAYS' | 'CONDITIONAL' | 'REQUIRES_LIVE_SCAN';
  recommendation: string;
  remediation: string;
  suggestedLanguage: string | null;
  detectionSummary?: {
    anchors: number;
    supporting: number;
    specifics: string[];
    semanticConcepts: string[];
    portedFrom: string | null;
  };
}

export interface ApiFinding {
  id: string;
  ruleId: string;
  status: ApiRuleStatus;
  applicable: boolean;
  applicabilityReason: string | null;
  confidence: number;
  credit: number;
  points: number;
  maxPoints: number;
  evidence: ApiEvidence[];
  matchedSpecifics: string[];
  missingSpecifics: string[];
  negationDetected: boolean;
  hedgingDetected: boolean;
  semanticSupport: boolean;
  reasoning: string;
  recommendation: string | null;
  remediation: string | null;
  legalReference: string | null;
  severity: ApiSeverity;
  priority: ApiPriority | null;
  rule: ApiRule;
}

export interface ApiCategoryScore {
  id: string;
  label: string;
  order: number;
  score: number;
  earned: number;
  possible: number;
  rules: number;
  weight: number;
  designDocWeight: ApiWeightClass;
}

export interface ApiScanScore {
  overallScore: number;
  verdict: string;
  scoringModel: string;
  earnedPoints: number;
  maxPoints: number;
  passedCount: number;
  partialCount: number;
  failedCount: number;
  notApplicableCount: number;
  categoryScores: ApiCategoryScore[];
}

export interface ApiRiskFactor {
  code: string;
  label: string;
  detail: string;
  triggered: boolean;
  weight: number;
}

export interface ApiRiskAssessment {
  level: ApiRiskLevel;
  explanation: string;
  factors: ApiRiskFactor[];
  criticalFindings: number;
  highFindings: number;
}

export interface ApiScanSummary {
  id: string;
  fileName: string;
  fileType: string;
  fileSize: number;
  status: ScanStatus;
  stage: ScanStage;
  error: string | null;
  pages: number | null;
  words: number | null;
  sentences: number | null;
  paragraphs: number | null;
  nlpAvailable: boolean;
  ruleVersion: string | null;
  durationMs: number | null;
  createdAt: string;
  completedAt: string | null;
  score: ApiScanScore | null;
  risk: { level: ApiRiskLevel } | null;
}

export interface ApiScanDetail extends Omit<ApiScanSummary, 'score' | 'risk'> {
  extractionRate: number | null;
  extractedText: string | null;
  score: ApiScanScore | null;
  risk: ApiRiskAssessment | null;
  findings: ApiFinding[];
}

export interface ApiScanStatus {
  id: string;
  status: ScanStatus;
  stage: ScanStage;
  error: string | null;
  durationMs: number | null;
  nlpAvailable: boolean;
}

export interface ApiFrameworkCategory {
  id: string;
  order: number;
  label: string;
  ruleCount: number;
  ruleIds: string[];
  categoryWeight: number;
  designDocWeight: ApiWeightClass;
  mandatory: number;
  conditional: number;
  recommended: number;
  sourceTypes: ApiSourceType[];
}

export interface ApiFramework {
  framework: string;
  pack: string;
  ruleVersion: string;
  legalVersion: string;
  scoringModel: string;
  generatedAt: string;
  sourceUrl: string;
  totals: Record<string, number>;
  effectiveness: {
    inForce: number;
    notYetInForce: number;
    unknown: number;
    assessedOn: string;
  };
  provenance: Record<string, unknown>;
  categories: ApiFrameworkCategory[];
  scoring: {
    model: string;
    points: Record<string, Record<string, number | string>>;
    categoryFormula: string;
    overallFormula: string;
    note: string;
  };
}
