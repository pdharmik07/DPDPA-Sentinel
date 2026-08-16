/**
 * Contract tests for the NLP service response.
 *
 * These exist because of a bug that hid for the entire life of the feature:
 * Pydantic serialises an unset `Optional[list[str]]` as JSON `null`, while the
 * client schema used `.optional()`, which accepts only `undefined`. Every
 * /analyze response failed validation, so every scan silently fell back to the
 * deterministic engine — and because that fallback is well-behaved, nothing
 * looked wrong. The integration suite ran with NLP_ENABLED=false and never
 * exercised the path.
 *
 * The payloads below are exactly what FastAPI emits. They are checked against
 * the real client schema, so a future change on either side fails here rather
 * than degrading in silence.
 */

import { describe, expect, it } from 'vitest';
import { nlpResponseSchema } from '../src/services/nlpClient.js';

/** What Pydantic produces when `lemmas` is left unset (pre-exclude_none). */
const RESPONSE_WITH_NULL_LEMMAS = {
  model: 'sentence-transformers/all-MiniLM-L6-v2',
  byRule: {
    C4: {
      ruleId: 'C4',
      bestSimilarity: 0.7453,
      sentences: [
        { index: 2, similarity: 0.7453, negated: true, lemmas: null },
        { index: 0, similarity: 0.6827, negated: false, lemmas: null },
      ],
    },
  },
};

/** What it produces with response_model_exclude_none=True. */
const RESPONSE_WITHOUT_LEMMAS = {
  model: 'sentence-transformers/all-MiniLM-L6-v2',
  byRule: {
    C4: {
      ruleId: 'C4',
      bestSimilarity: 0.6827,
      sentences: [{ index: 0, similarity: 0.6827, negated: false }],
    },
  },
};

const RESPONSE_WITH_LEMMAS = {
  model: 'sentence-transformers/all-MiniLM-L6-v2',
  byRule: {
    C4: {
      ruleId: 'C4',
      bestSimilarity: 0.68,
      sentences: [{ index: 0, similarity: 0.68, negated: false, lemmas: ['revoke', 'permission'] }],
    },
  },
};

describe('NLP response contract', () => {
  it('accepts lemmas serialised as null', () => {
    // The exact shape that silently broke the integration.
    const result = nlpResponseSchema.safeParse(RESPONSE_WITH_NULL_LEMMAS);
    expect(result.success, JSON.stringify(result.error?.issues)).toBe(true);
  });

  it('accepts lemmas omitted entirely', () => {
    expect(nlpResponseSchema.safeParse(RESPONSE_WITHOUT_LEMMAS).success).toBe(true);
  });

  it('accepts lemmas present', () => {
    expect(nlpResponseSchema.safeParse(RESPONSE_WITH_LEMMAS).success).toBe(true);
  });

  it('accepts an empty byRule map', () => {
    const empty = { model: 'x', byRule: {} };
    expect(nlpResponseSchema.safeParse(empty).success).toBe(true);
  });

  it('rejects a similarity outside 0..1', () => {
    const bad = {
      model: 'x',
      byRule: { C4: { ruleId: 'C4', bestSimilarity: 1.5, sentences: [] } },
    };
    expect(nlpResponseSchema.safeParse(bad).success).toBe(false);
  });

  it('rejects a missing negated flag', () => {
    const bad = {
      model: 'x',
      byRule: {
        C4: { ruleId: 'C4', bestSimilarity: 0.5, sentences: [{ index: 0, similarity: 0.5 }] },
      },
    };
    expect(nlpResponseSchema.safeParse(bad).success).toBe(false);
  });

  it('rejects a verdict-like field being smuggled in', () => {
    // The NLP service must never express a compliance outcome. If someone adds
    // one, the strict schema drops it — this pins that the client ignores it.
    const withVerdict = {
      model: 'x',
      byRule: {
        C4: {
          ruleId: 'C4',
          bestSimilarity: 0.9,
          status: 'PASS',
          sentences: [{ index: 0, similarity: 0.9, negated: false }],
        },
      },
    };
    const parsed = nlpResponseSchema.safeParse(withVerdict);
    expect(parsed.success).toBe(true);
    expect(parsed.success && 'status' in parsed.data.byRule.C4!).toBe(false);
  });
});
