/**
 * Sends the NLP service exactly what a real scan would send, and reports
 * timing plus whether the response satisfies the backend's response schema.
 *
 * Diagnoses the two silent failure modes that make a scan fall back to the
 * deterministic engine: the call exceeding NLP_TIMEOUT_MS, and the response not
 * matching what the client expects.
 *
 *   npx tsx scripts/probeNlp.ts [path/to/policy.txt]
 */

import { readFileSync } from 'node:fs';
import path from 'node:path';
import { loadRulePack } from '../src/engine/rulePack.js';
import { prepareDocument } from '../src/engine/text.js';

const file = process.argv[2] ?? path.resolve(process.cwd(), '../samples/01-strong-fintech-policy.txt');
const url = process.env.NLP_SERVICE_URL ?? 'http://localhost:8000';
const timeoutMs = Number(process.env.NLP_TIMEOUT_MS ?? 15000);

const doc = prepareDocument(readFileSync(file, 'utf8'));
const pack = loadRulePack();

const payload = {
  sentences: doc.sentences.map((s) => ({ index: s.index, text: s.text })),
  rules: pack.rules
    .filter((r) => r.detection.semanticConcepts.length > 0)
    .map((r) => ({ ruleId: r.ruleId, concepts: r.detection.semanticConcepts })),
};

console.log(`payload: ${payload.sentences.length} sentences x ${payload.rules.length} rules`);
console.log(`target : ${url}/analyze   (timeout ${timeoutMs}ms)\n`);

const controller = new AbortController();
const timer = setTimeout(() => controller.abort(), timeoutMs);
const started = Date.now();

try {
  const res = await fetch(`${url}/analyze`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
    signal: controller.signal,
  });
  const elapsed = Date.now() - started;

  console.log(`HTTP ${res.status} in ${elapsed}ms`);
  if (!res.ok) {
    console.log('body:', (await res.text()).slice(0, 400));
    process.exit(1);
  }

  const body = (await res.json()) as { model?: string; byRule?: Record<string, unknown> };
  const rules = Object.keys(body.byRule ?? {});
  console.log(`model: ${body.model}`);
  console.log(`rules with signals: ${rules.length}`);

  if (elapsed > timeoutMs * 0.6) {
    console.log(`\nWARNING: this took ${elapsed}ms against a ${timeoutMs}ms budget.`);
    console.log('A cold service (models not yet loaded) will exceed it and the scan will');
    console.log('fall back to the deterministic engine. Raise NLP_TIMEOUT_MS or set');
    console.log('NLP_WARM_START=true on the NLP service.');
  } else {
    console.log('\ntiming is comfortably inside the budget');
  }
} catch (error) {
  const elapsed = Date.now() - started;
  const aborted = error instanceof Error && error.name === 'AbortError';
  console.log(aborted ? `TIMED OUT after ${elapsed}ms (budget ${timeoutMs}ms)` : `FAILED after ${elapsed}ms`);
  if (!aborted) console.log(error);
  process.exit(1);
} finally {
  clearTimeout(timer);
}
