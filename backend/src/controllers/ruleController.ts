/**
 * Rule and framework endpoints.
 *
 * These serve the rule pack itself — public reference data derived from the
 * DPDP Act 2023 and the DPDP Rules 2025. They contain no user data, so they are
 * readable without authentication; that also lets the Framework page render
 * before a user signs in.
 *
 * Detection regex is deliberately NOT exposed: publishing the exact patterns
 * would let a policy be written to game the scanner rather than to comply.
 */

import type { Request, Response } from 'express';
import { isEffectiveOn, loadRulePack } from '../engine/rulePack.js';
import type { CompiledRule } from '../engine/types.js';
import { AppError } from '../utils/errors.js';

function present(rule: CompiledRule, on: Date) {
  const inForce = isEffectiveOn(rule, on);
  return {
    ruleId: rule.ruleId,
    category: rule.category,
    categoryLabel: rule.categoryLabel,
    title: rule.title,
    description: rule.description,
    requirement: rule.requirement,

    sourceType: rule.sourceType,
    legalBasis: rule.legalBasis,
    actSection: rule.actSection,
    ruleReference: rule.ruleReference,
    scheduleReference: rule.scheduleReference,
    sourceUrl: rule.sourceUrl,
    legalReference: [
      rule.actSection ? `DPDPA 2023, ${rule.actSection}` : null,
      rule.ruleReference ? `DPDP Rules 2025, ${rule.ruleReference}` : null,
      rule.scheduleReference,
    ]
      .filter(Boolean)
      .join('; '),

    ruleVersion: rule.ruleVersion,
    legalVersion: rule.legalVersion,
    effectiveFrom: rule.effectiveFrom,
    effectiveTo: rule.effectiveTo,
    effectiveNote: rule.effectiveNote,
    /** true / false / null when the sources do not establish a date. */
    inForce,
    effectiveStatus: inForce === null ? 'UNKNOWN' : inForce ? 'IN_FORCE' : 'NOT_YET_IN_FORCE',

    weightClass: rule.weightClass,
    weight: rule.weight,
    severity: rule.severity,
    applicability: rule.applicability,

    recommendation: rule.recommendation,
    remediation: rule.remediation,
    suggestedLanguage: rule.suggestedLanguage,

    /** Counts only — the patterns themselves stay server-side. */
    detectionSummary: {
      anchors: rule.detection.anchors.length,
      supporting: rule.detection.supporting.length,
      specifics: rule.detection.specifics.map((s) => s.label),
      semanticConcepts: rule.detection.semanticConcepts,
      portedFrom: rule.detection.portedFrom,
    },
  };
}

export function listRules(req: Request, res: Response): void {
  const pack = loadRulePack();
  const on = new Date();

  const category = typeof req.query.category === 'string' ? req.query.category : undefined;
  const rules = pack.rules
    .filter((r) => (category ? r.category === category : true))
    .map((r) => present(r, on));

  res.json({
    ruleVersion: pack.manifest.ruleVersion,
    legalVersion: pack.manifest.legalVersion,
    count: rules.length,
    rules,
  });
}

export function getRule(req: Request, res: Response): void {
  const pack = loadRulePack();
  const rule = pack.byId.get(String(req.params.id));
  if (!rule) throw AppError.notFound(`No rule with id "${String(req.params.id)}".`);
  res.json({ rule: present(rule, new Date()) });
}

/**
 * Framework overview: the manifest plus per-category rollups, for the
 * Framework page.
 */
export function getFramework(_req: Request, res: Response): void {
  const pack = loadRulePack();
  const on = new Date();

  const categories = pack.manifest.categories.map((c) => {
    const rules = pack.rules.filter((r) => r.category === c.id);
    return {
      ...c,
      mandatory: rules.filter((r) => r.weightClass === 'MANDATORY').length,
      conditional: rules.filter((r) => r.weightClass === 'CONDITIONAL').length,
      recommended: rules.filter((r) => r.weightClass === 'RECOMMENDED').length,
      sourceTypes: [...new Set(rules.map((r) => r.sourceType))],
    };
  });

  const inForce = pack.rules.filter((r) => isEffectiveOn(r, on) === true).length;
  const notYet = pack.rules.filter((r) => isEffectiveOn(r, on) === false).length;
  const unknown = pack.rules.filter((r) => isEffectiveOn(r, on) === null).length;

  res.json({
    framework: 'DPDPA 2023 + DPDP Rules 2025',
    pack: pack.manifest.pack,
    ruleVersion: pack.manifest.ruleVersion,
    legalVersion: pack.manifest.legalVersion,
    scoringModel: pack.manifest.scoringModel,
    generatedAt: pack.manifest.generatedAt,
    sourceUrl: pack.manifest.sourceUrl,
    totals: pack.manifest.totals,
    effectiveness: { inForce, notYetInForce: notYet, unknown, assessedOn: on.toISOString().slice(0, 10) },
    provenance: pack.manifest.provenance,
    categories,
    scoring: {
      model: pack.manifest.scoringModel,
      points: {
        MANDATORY: { PASS: 3, PARTIAL: 1, FAIL: 0 },
        CONDITIONAL: { PASS: 2, PARTIAL: 1, FAIL: 0, NOT_APPLICABLE: 'excluded' },
        RECOMMENDED: { PASS: 1, PARTIAL: 0.5, FAIL: 0 },
      },
      categoryFormula: '(points earned in category / max points for applicable rules in category) x 100',
      overallFormula: 'weighted average of category scores, weighted by the sum of applicable rule weights',
      note: 'Category weights are derived as the sum of applicable member rule weights. The design document requires mandatory categories to count for more but does not state explicit weights.',
    },
  });
}
