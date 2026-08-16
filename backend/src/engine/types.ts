/**
 * Domain model for the DPDPA Sentinel compliance engine.
 *
 * Everything in this file is pure data. The engine modules that consume it are
 * pure functions: same input, same output, no I/O. That is what makes the
 * assessment deterministic and unit-testable independently of the NLP service.
 */

export type WeightClass = 'MANDATORY' | 'CONDITIONAL' | 'RECOMMENDED';
export type RuleStatus = 'PASS' | 'PARTIAL' | 'FAIL' | 'NOT_APPLICABLE';
export type SourceType = 'ACT' | 'RULES_2025' | 'PROJECT_SPECIFIC' | 'BEST_PRACTICE';
export type Applicability = 'ALWAYS' | 'CONDITIONAL' | 'REQUIRES_LIVE_SCAN';
export type Severity = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
export type Priority = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
export type RiskLevel = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';

/**
 * Points awarded per status, per weight class.
 *
 * This table is taken verbatim from section 5 ("Scoring Logic") of the supplied
 * DPDPA Sentinel Rule Engine Design Document:
 *
 *   Mandatory   = 3 if Present, 1 if Partial, 0 if Absent
 *   Conditional = 2 if Present, 1 if Partial, 0 if Absent, excluded if N/A
 *   Recommended = 1 if Present, 0.5 if Partial, 0 if Absent
 *
 * Note this differs from the pre-existing frontend engine, which credited a
 * partial mandatory rule at 1.5 (half of 3). The design document is the
 * specified source of truth for scoring, so 1 is used here.
 */
export const POINTS: Record<WeightClass, Record<Exclude<RuleStatus, 'NOT_APPLICABLE'>, number>> = {
  MANDATORY: { PASS: 3, PARTIAL: 1, FAIL: 0 },
  CONDITIONAL: { PASS: 2, PARTIAL: 1, FAIL: 0 },
  RECOMMENDED: { PASS: 1, PARTIAL: 0.5, FAIL: 0 },
};

/** Maximum points a rule can earn — i.e. its PASS value. */
export const MAX_POINTS: Record<WeightClass, number> = {
  MANDATORY: 3,
  CONDITIONAL: 2,
  RECOMMENDED: 1,
};

/** Relative weight of a rule, used to derive category weights. */
export const WEIGHT: Record<WeightClass, number> = {
  MANDATORY: 3,
  CONDITIONAL: 2,
  RECOMMENDED: 1,
};

// ── Rule definitions (as loaded from the rule pack) ─────────────────────────

export interface SpecificPattern {
  label: string;
  pattern: string;
}

export interface RuleDetection {
  anchors: string[];
  supporting: string[];
  specifics: SpecificPattern[];
  applicabilityTriggers: string[];
  negativeIndicators: string[];
  /** Natural-language concepts handed to the NLP service for similarity scoring. */
  semanticConcepts: string[];
  /** Provenance: the frontend requirement id this payload was ported from. */
  portedFrom: string | null;
}

export interface RuleDefinition {
  ruleId: string;
  category: string;
  categoryLabel: string;
  title: string;
  description: string;
  requirement: string;

  sourceType: SourceType;
  legalBasis: string | null;
  actSection: string | null;
  ruleReference: string | null;
  scheduleReference: string | null;
  sourceUrl: string | null;

  ruleVersion: string;
  legalVersion: string;
  effectiveFrom: string | null;
  effectiveTo: string | null;
  effectiveNote: string | null;

  weightClass: WeightClass;
  weight: number;
  severity: Severity;
  applicability: Applicability;

  detection: RuleDetection;

  recommendation: string;
  remediation: string;
  suggestedLanguage: string | null;
}

/** A rule with its detection patterns pre-compiled to RegExp. */
export interface CompiledRule extends RuleDefinition {
  compiled: {
    anchors: RegExp[];
    supporting: RegExp[];
    specifics: { label: string; pattern: RegExp }[];
    applicabilityTriggers: RegExp[];
    negativeIndicators: RegExp[];
  };
}

export interface RulePackManifest {
  pack: string;
  ruleVersion: string;
  legalVersion: string;
  sourceUrl: string;
  generatedAt: string;
  scoringModel: string;
  totals: Record<string, number>;
  categories: CategoryManifest[];
  provenance: Record<string, unknown>;
}

export interface CategoryManifest {
  id: string;
  order: number;
  label: string;
  ruleCount: number;
  ruleIds: string[];
  categoryWeight: number;
  designDocWeight: WeightClass;
}

// ── Preprocessed document ───────────────────────────────────────────────────

export interface Sentence {
  index: number;
  text: string;
  /** Index of the paragraph this sentence belongs to. */
  paragraph: number;
}

export interface PreparedDocument {
  text: string;
  sentences: Sentence[];
  paragraphs: string[];
  sections: string[];
  words: number;
  characters: number;
}

// ── NLP (advisory) ──────────────────────────────────────────────────────────

/**
 * The NLP service's contribution. Note there is deliberately no status field:
 * the semantic layer can raise confidence and surface candidate evidence, but
 * it cannot pronounce on compliance. That decision belongs to the rule engine.
 */
export interface NlpSentenceSignal {
  index: number;
  /** 0..1 cosine similarity against the best-matching rule concept. */
  similarity: number;
  negated: boolean;
  /** Null when the service omits it — Pydantic sends unset Optionals as null. */
  lemmas?: string[] | null;
}

export interface NlpRuleSignal {
  ruleId: string;
  sentences: NlpSentenceSignal[];
  bestSimilarity: number;
}

export interface NlpAnalysis {
  available: boolean;
  model: string | null;
  byRule: Record<string, NlpRuleSignal>;
}

// ── Findings ────────────────────────────────────────────────────────────────

export interface EvidenceItem {
  sentence: string;
  index: number;
  paragraph: number;
  /** Deterministic match score, 0..~1.4. */
  score: number;
  negated: boolean;
  hedged: boolean;
  /** Semantic similarity from the NLP service, when available. */
  semanticScore: number | null;
}

export interface Finding {
  ruleId: string;
  rule: RuleDefinition;
  status: RuleStatus;

  applicable: boolean;
  applicabilityReason: string | null;

  confidence: number;
  credit: number;
  points: number;
  maxPoints: number;

  evidence: EvidenceItem[];
  matchedSpecifics: string[];
  missingSpecifics: string[];

  negationDetected: boolean;
  hedgingDetected: boolean;
  semanticSupport: boolean;

  reasoning: string;
  legalReference: string;
  severity: Severity;
}

export interface Recommendation {
  ruleId: string;
  title: string;
  category: string;
  categoryLabel: string;
  issue: string;
  explanation: string;
  legalReference: string;
  sourceType: SourceType;
  recommendation: string;
  remediation: string;
  suggestedLanguage: string | null;
  priority: Priority;
  status: RuleStatus;
}

export interface CategoryScore {
  id: string;
  label: string;
  order: number;
  /** 0..100 for this category. */
  score: number;
  earned: number;
  possible: number;
  /** Number of applicable rules scored in this category. */
  rules: number;
  /** Weight this category carries in the overall weighted average. */
  weight: number;
  designDocWeight: WeightClass;
}

export interface ScoreResult {
  overallScore: number;
  verdict: string;
  scoringModel: string;
  earnedPoints: number;
  maxPoints: number;
  categoryScores: CategoryScore[];
  passedCount: number;
  partialCount: number;
  failedCount: number;
  notApplicableCount: number;
}

export interface RiskFactor {
  code: string;
  label: string;
  detail: string;
  triggered: boolean;
  /** Contribution toward the risk level when triggered. */
  weight: number;
}

export interface RiskResult {
  level: RiskLevel;
  explanation: string;
  factors: RiskFactor[];
  criticalFindings: number;
  highFindings: number;
}

export interface AnalysisResult {
  findings: Finding[];
  score: ScoreResult;
  risk: RiskResult;
  recommendations: Recommendation[];
  document: {
    words: number;
    characters: number;
    sentences: number;
    paragraphs: number;
    sections: number;
  };
  ruleVersion: string;
  legalVersion: string;
  nlpAvailable: boolean;
}
