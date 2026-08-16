/**
 * Seeds the rule pack into the database.
 *
 * Idempotent: re-running upserts by ruleId, so a rule pack revision can be
 * applied without dropping historical findings (Finding.ruleId references
 * Rule.ruleId with onDelete: Restrict, so a rule in use cannot be removed).
 *
 *   npm run db:seed
 */

import { PrismaClient } from '@prisma/client';
import { loadRulePack } from '../src/engine/rulePack.js';

const prisma = new PrismaClient();

async function main(): Promise<void> {
  const pack = loadRulePack();
  console.log(`Seeding rule pack ${pack.manifest.pack} v${pack.manifest.ruleVersion} — ${pack.rules.length} rules`);

  let created = 0;
  let updated = 0;

  for (const rule of pack.rules) {
    const data = {
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

      ruleVersion: rule.ruleVersion,
      legalVersion: rule.legalVersion,
      effectiveFrom: rule.effectiveFrom ? new Date(rule.effectiveFrom) : null,
      effectiveTo: rule.effectiveTo ? new Date(rule.effectiveTo) : null,
      effectiveNote: rule.effectiveNote,

      weightClass: rule.weightClass,
      weight: rule.weight,
      severity: rule.severity,
      applicability: rule.applicability,

      detection: rule.detection as unknown as object,

      recommendation: rule.recommendation,
      remediation: rule.remediation,
      suggestedLanguage: rule.suggestedLanguage,
    };

    const existing = await prisma.rule.findUnique({ where: { ruleId: rule.ruleId } });
    await prisma.rule.upsert({
      where: { ruleId: rule.ruleId },
      create: { ruleId: rule.ruleId, ...data },
      update: data,
    });
    if (existing) updated += 1;
    else created += 1;
  }

  // Report (but do not delete) rules that are in the database yet absent from
  // the pack — deleting one would orphan historical findings.
  const packIds = new Set(pack.rules.map((r) => r.ruleId));
  const stale = (await prisma.rule.findMany({ select: { ruleId: true } })).filter((r) => !packIds.has(r.ruleId));

  console.log(`  created ${created}, updated ${updated}`);
  if (stale.length) {
    console.warn(
      `  ${stale.length} rule(s) in the database are not in this pack and were left untouched: ${stale
        .map((r) => r.ruleId)
        .join(', ')}`,
    );
  }
  console.log('Seed complete.');
}

main()
  .catch((error: unknown) => {
    console.error('Seed failed:', error);
    process.exit(1);
  })
  .finally(() => {
    void prisma.$disconnect();
  });
