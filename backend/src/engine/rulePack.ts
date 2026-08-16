/**
 * Rule pack loader.
 *
 * Rules live as versioned JSON data under backend/rules/<version>/. They are
 * validated against a schema at boot and their regex payloads are compiled
 * once. No rule-specific logic exists anywhere in the engine modules — adding
 * or amending a rule is a data change, not a code change.
 */

import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { z } from 'zod';
import type { CompiledRule, RuleDefinition, RulePackManifest } from './types.js';

const here = path.dirname(fileURLToPath(import.meta.url));
/** backend/src/engine -> backend/rules */
const RULES_ROOT = path.resolve(here, '../../rules');

export const DEFAULT_PACK = 'dpdpa-v1.0.0';

const specificSchema = z.object({
  label: z.string().min(1),
  pattern: z.string().min(1),
});

const detectionSchema = z.object({
  anchors: z.array(z.string().min(1)).min(1, 'a rule must have at least one anchor'),
  supporting: z.array(z.string()),
  specifics: z.array(specificSchema),
  applicabilityTriggers: z.array(z.string()),
  negativeIndicators: z.array(z.string()),
  semanticConcepts: z.array(z.string()),
  portedFrom: z.string().nullable(),
});

const ruleSchema = z.object({
  ruleId: z.string().min(1),
  category: z.string().min(1),
  categoryLabel: z.string().min(1),
  title: z.string().min(1),
  description: z.string().min(1),
  requirement: z.string().min(1),

  sourceType: z.enum(['ACT', 'RULES_2025', 'PROJECT_SPECIFIC', 'BEST_PRACTICE']),
  legalBasis: z.string().nullable(),
  actSection: z.string().nullable(),
  ruleReference: z.string().nullable(),
  scheduleReference: z.string().nullable(),
  sourceUrl: z.string().nullable(),

  ruleVersion: z.string().min(1),
  legalVersion: z.string().min(1),
  effectiveFrom: z.string().nullable(),
  effectiveTo: z.string().nullable(),
  effectiveNote: z.string().nullable(),

  weightClass: z.enum(['MANDATORY', 'CONDITIONAL', 'RECOMMENDED']),
  weight: z.number().positive(),
  severity: z.enum(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']),
  applicability: z.enum(['ALWAYS', 'CONDITIONAL', 'REQUIRES_LIVE_SCAN']),

  detection: detectionSchema,

  recommendation: z.string().min(1),
  remediation: z.string().min(1),
  suggestedLanguage: z.string().nullable(),
});

const manifestSchema = z.object({
  pack: z.string(),
  ruleVersion: z.string(),
  legalVersion: z.string(),
  sourceUrl: z.string(),
  generatedAt: z.string(),
  scoringModel: z.string(),
  totals: z.record(z.number()),
  categories: z.array(
    z.object({
      id: z.string(),
      order: z.number(),
      label: z.string(),
      ruleCount: z.number(),
      ruleIds: z.array(z.string()),
      categoryWeight: z.number(),
      designDocWeight: z.enum(['MANDATORY', 'CONDITIONAL', 'RECOMMENDED']),
    }),
  ),
  provenance: z.record(z.unknown()),
});

function compile(patterns: string[]): RegExp[] {
  return patterns.map((p) => new RegExp(p, 'i'));
}

export interface LoadedRulePack {
  version: string;
  manifest: RulePackManifest;
  rules: CompiledRule[];
  byId: Map<string, CompiledRule>;
}

let cache: LoadedRulePack | null = null;

export function loadRulePack(version: string = DEFAULT_PACK): LoadedRulePack {
  if (cache && cache.version === version) return cache;

  const dir = path.join(RULES_ROOT, version);
  const rawRules: unknown = JSON.parse(readFileSync(path.join(dir, 'rules.json'), 'utf8'));
  const rawManifest: unknown = JSON.parse(readFileSync(path.join(dir, 'manifest.json'), 'utf8'));

  const manifest = manifestSchema.parse(rawManifest) as RulePackManifest;
  const parsed = z.array(ruleSchema).parse(rawRules) as RuleDefinition[];

  const seen = new Set<string>();
  const rules: CompiledRule[] = parsed.map((r) => {
    if (seen.has(r.ruleId)) throw new Error(`rule pack ${version}: duplicate ruleId ${r.ruleId}`);
    seen.add(r.ruleId);

    if (r.applicability === 'CONDITIONAL' && r.detection.applicabilityTriggers.length === 0) {
      throw new Error(`rule pack ${version}: ${r.ruleId} is CONDITIONAL but has no applicabilityTriggers`);
    }

    return {
      ...r,
      compiled: {
        anchors: compile(r.detection.anchors),
        supporting: compile(r.detection.supporting),
        specifics: r.detection.specifics.map((s) => ({ label: s.label, pattern: new RegExp(s.pattern, 'i') })),
        applicabilityTriggers: compile(r.detection.applicabilityTriggers),
        negativeIndicators: compile(r.detection.negativeIndicators),
      },
    };
  });

  // Every category referenced by a rule must exist in the manifest, and vice versa.
  const manifestCategories = new Set(manifest.categories.map((c) => c.id));
  for (const r of rules) {
    if (!manifestCategories.has(r.category)) {
      throw new Error(`rule pack ${version}: ${r.ruleId} references unknown category "${r.category}"`);
    }
  }

  cache = { version, manifest, rules, byId: new Map(rules.map((r) => [r.ruleId, r])) };
  return cache;
}

/** Test hook — forces the next loadRulePack() to re-read from disk. */
export function clearRulePackCache(): void {
  cache = null;
}

/**
 * Whether a rule's legal basis is in force on a given date.
 *
 * This matters: the DPDP Rules 2025 commence in three tranches, and most of the
 * operative compliance rules do not come into force until 13 May 2027. A report
 * must be able to say a rule is assessed but not yet enforceable.
 */
export function isEffectiveOn(rule: RuleDefinition, on: Date = new Date()): boolean | null {
  if (!rule.effectiveFrom) return null; // unknown — see effectiveNote
  const from = new Date(rule.effectiveFrom);
  if (Number.isNaN(from.getTime())) return null;
  if (on < from) return false;
  if (rule.effectiveTo) {
    const to = new Date(rule.effectiveTo);
    if (!Number.isNaN(to.getTime()) && on > to) return false;
  }
  return true;
}
