/**
 * Developer smoke run: analyse the repository's sample policies with the
 * deterministic engine only (no NLP, no database) and print a summary.
 *
 *   npx tsx scripts/smoke.ts
 */

import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { analyzeText } from '../src/engine/analyze.js';
import { loadRulePack } from '../src/engine/rulePack.js';

const SAMPLES = path.resolve(process.cwd(), '../samples');

const pack = loadRulePack();
console.log(
  `rule pack ${pack.manifest.pack} v${pack.manifest.ruleVersion} — ${pack.rules.length} rules, ${pack.manifest.categories.length} categories\n`,
);

const files = readdirSync(SAMPLES).filter((f) => /\.(txt|md)$/i.test(f));

for (const file of files) {
  const text = readFileSync(path.join(SAMPLES, file), 'utf8');
  const started = performance.now();
  const result = analyzeText(text);
  const ms = Math.round(performance.now() - started);

  const s = result.score;
  console.log(`── ${file}`);
  console.log(
    `   score ${s.overallScore}  (${s.verdict})  risk ${result.risk.level}  ` +
      `pass ${s.passedCount} / partial ${s.partialCount} / fail ${s.failedCount} / n-a ${s.notApplicableCount}  [${ms}ms]`,
  );
  console.log(`   points ${s.earnedPoints}/${s.maxPoints}   recommendations ${result.recommendations.length}`);

  const top = result.recommendations.slice(0, 3);
  for (const r of top) console.log(`      · [${r.priority}] ${r.ruleId} ${r.title}`);

  // Determinism check: identical input must produce an identical result.
  const again = analyzeText(text);
  const stable = JSON.stringify(strip(result)) === JSON.stringify(strip(again));
  console.log(`   deterministic: ${stable ? 'yes' : 'NO — INVESTIGATE'}\n`);
}

function strip(r: ReturnType<typeof analyzeText>) {
  return { findings: r.findings.map((f) => [f.ruleId, f.status, f.points]), score: r.score, risk: r.risk.level };
}
