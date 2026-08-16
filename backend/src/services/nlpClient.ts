/**
 * Client for the Python NLP service.
 *
 * The NLP layer is advisory and strictly optional. If it is disabled,
 * unreachable, slow or returns something unexpected, the scan continues on the
 * deterministic rule engine alone and the result is flagged nlpAvailable=false.
 * An analysis must never fail because Python is down.
 */

import { z } from 'zod';
import { env } from '../config/env.js';
import { logger } from '../config/logger.js';
import type { CompiledRule, NlpAnalysis, PreparedDocument } from '../engine/types.js';

const responseSchema = z.object({
  model: z.string(),
  byRule: z.record(
    z.object({
      ruleId: z.string(),
      bestSimilarity: z.number().min(0).max(1),
      sentences: z.array(
        z.object({
          index: z.number().int().nonnegative(),
          similarity: z.number().min(0).max(1),
          negated: z.boolean(),
          lemmas: z.array(z.string()).optional(),
        }),
      ),
    }),
  ),
});

export const NLP_UNAVAILABLE: NlpAnalysis = { available: false, model: null, byRule: {} };

export interface NlpRequest {
  sentences: { index: number; text: string }[];
  rules: { ruleId: string; concepts: string[] }[];
}

export async function analyzeWithNlp(
  doc: PreparedDocument,
  rules: CompiledRule[],
  requestId?: string,
): Promise<NlpAnalysis> {
  if (!env.NLP_ENABLED) return NLP_UNAVAILABLE;

  const payload: NlpRequest = {
    sentences: doc.sentences.map((s) => ({ index: s.index, text: s.text })),
    rules: rules
      .filter((r) => r.detection.semanticConcepts.length > 0)
      .map((r) => ({ ruleId: r.ruleId, concepts: r.detection.semanticConcepts })),
  };

  if (payload.rules.length === 0) return NLP_UNAVAILABLE;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), env.NLP_TIMEOUT_MS);

  try {
    const res = await fetch(`${env.NLP_SERVICE_URL}/analyze`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });

    if (!res.ok) {
      logger.warn({ requestId, status: res.status }, 'NLP service returned a non-OK status; continuing without it');
      return NLP_UNAVAILABLE;
    }

    const parsed = responseSchema.safeParse(await res.json());
    if (!parsed.success) {
      logger.warn({ requestId }, 'NLP service response did not match the expected shape; continuing without it');
      return NLP_UNAVAILABLE;
    }

    return { available: true, model: parsed.data.model, byRule: parsed.data.byRule };
  } catch (error) {
    const reason = error instanceof Error && error.name === 'AbortError' ? 'timeout' : 'unreachable';
    logger.warn({ requestId, reason }, 'NLP service unavailable; falling back to the deterministic engine');
    return NLP_UNAVAILABLE;
  } finally {
    clearTimeout(timer);
  }
}

export async function nlpHealthy(): Promise<boolean> {
  if (!env.NLP_ENABLED) return false;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 2500);
  try {
    const res = await fetch(`${env.NLP_SERVICE_URL}/health`, { signal: controller.signal });
    return res.ok;
  } catch {
    return false;
  } finally {
    clearTimeout(timer);
  }
}
