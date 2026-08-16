/**
 * Domain model for the DPDPA compliance engine.
 *
 * Weight classes follow the scoring plan in the project proposal:
 *   mandatory   -> 3  (e.g. consent, breach notification)
 *   conditional -> 2  (e.g. children's data, cross-border transfer)
 *   recommended -> 1  (best-practice clauses)
 */

export type WeightClass = 'mandatory' | 'conditional' | 'recommended';

export const WEIGHTS: Record<WeightClass, number> = {
  mandatory: 3,
  conditional: 2,
  recommended: 1,
};

export type ComplianceStatus =
  | 'compliant'
  | 'partial'
  | 'non_compliant'
  | 'not_detected'
  | 'not_applicable';

export type RiskLevel = 'critical' | 'high' | 'medium' | 'low' | 'none';

/**
 * Category identifier.
 *
 * Widened from a fixed union to `string` when the rule set moved server-side:
 * the backend rule pack defines 16 categories (the Rule Engine Design
 * Document's 15 plus a supplementary group), and the authoritative list now
 * arrives from GET /api/framework rather than being hard-coded here.
 */
export type CategoryId = string;

export interface Category {
  id: CategoryId;
  label: string;
  blurb: string;
}

/** A single DPDPA clause-category the scanner tests a policy against. */
export interface Requirement {
  id: string;
  code: string;
  title: string;
  category: CategoryId;
  section: string;
  weightClass: WeightClass;
  /** What the Act asks for, in plain language. */
  summary: string;
  /** Why a gap here is a problem. */
  whyItMatters: string;
  /**
   * Strong signals. A hit here means the policy is genuinely talking about
   * this obligation, not just brushing past the vocabulary.
   */
  anchors: RegExp[];
  /** Weaker corroborating vocabulary; lifts confidence but never alone sufficient. */
  supporting: RegExp[];
  /**
   * Specific sub-elements the clause must actually spell out (e.g. a retention
   * clause needs a *period*, not just the word "retention"). Each hit adds depth.
   */
  specifics: { label: string; pattern: RegExp }[];
  /**
   * Only for `conditional` requirements: if none of these appear anywhere in the
   * document, the obligation is treated as not triggered and drops out of the
   * denominator instead of being scored as a failure.
   */
  applicabilityTriggers?: RegExp[];
  recommendation: string;
  suggestedLanguage: string;
  /**
   * Provenance, supplied by the backend rule pack. Optional because the type
   * predates the move to a server-side rule set.
   */
  sourceType?: 'ACT' | 'RULES_2025' | 'PROJECT_SPECIFIC' | 'BEST_PRACTICE';
  /** Commencement of the cited DPDP Rules 2025 provision, if established. */
  effectiveFrom?: string | null;
  effectiveNote?: string | null;
}

/** One sentence of the policy that evidences (or contradicts) a requirement. */
export interface Evidence {
  sentence: string;
  index: number;
  score: number;
  negated: boolean;
  hedged: boolean;
}

export interface RequirementFinding {
  requirement: Requirement;
  status: ComplianceStatus;
  /** 0..1 — how sure the engine is that the clause is present and adequate. */
  confidence: number;
  /** 0..1 — fraction of the requirement's weight that is credited. */
  credit: number;
  weight: number;
  risk: RiskLevel;
  evidence: Evidence[];
  matchedSpecifics: string[];
  missingSpecifics: string[];
  negationDetected: boolean;
  hedgingDetected: boolean;
  issue: string;
}

export interface ConceptFinding {
  id: string;
  label: string;
  description: string;
  frequency: number;
  confidence: number;
  detected: 'yes' | 'weak' | 'no';
  sampleSentence?: string;
}

export interface CategoryScore {
  id: CategoryId;
  label: string;
  score: number;
  earned: number;
  possible: number;
  requirements: number;
}

export interface DocumentStats {
  fileName: string;
  fileSize: number;
  fileType: string;
  pages: number;
  words: number;
  characters: number;
  sentences: number;
  sections: number;
  paragraphs: number;
  extractionRate: number;
  readingMinutes: number;
}

export interface RiskItem {
  level: RiskLevel;
  title: string;
  detail: string;
  requirementId: string;
}

export interface ScanResult {
  id: string;
  createdAt: string;
  durationMs: number;
  stats: DocumentStats;
  text: string;
  findings: RequirementFinding[];
  concepts: ConceptFinding[];
  categories: CategoryScore[];
  risks: RiskItem[];
  score: number;
  riskLevel: RiskLevel;
  verdict: string;
  totals: {
    checked: number;
    compliant: number;
    partial: number;
    nonCompliant: number;
    notDetected: number;
    notApplicable: number;
    earnedWeight: number;
    applicableWeight: number;
  };
}

/** Trimmed record kept in localStorage so history does not blow past the quota. */
export interface ScanHistoryEntry {
  id: string;
  createdAt: string;
  fileName: string;
  fileSize: number;
  pages: number;
  words: number;
  score: number;
  riskLevel: RiskLevel;
  verdict: string;
  durationMs: number;
  categories: CategoryScore[];
  totals: ScanResult['totals'];
}
