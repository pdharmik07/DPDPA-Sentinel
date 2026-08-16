/**
 * Applicability engine.
 *
 * Runs before detection. A rule that does not apply is never scored as a
 * failure — it is excluded from both numerator and denominator, so an
 * India-only service is not punished for having no cross-border clause.
 */

import type { CompiledRule, PreparedDocument } from './types.js';

export interface ApplicabilityVerdict {
  applicable: boolean;
  reason: string | null;
  /** The trigger phrases found in the document, for the audit trail. */
  matchedTriggers: string[];
}

/**
 * Rules whose triggers are inherently ambiguous get a corroboration
 * requirement: a single stray word must not switch on a whole category.
 *
 * "global" or "aws" alone should not make cross-border transfer applicable, and
 * one mention of "parent" should not make the entire children's-data category
 * applicable. Two independent signals are required for these.
 */
const REQUIRES_TWO_SIGNALS = new Set(['cross_border', 'children', 'sdf']);

export function evaluateApplicability(
  rule: CompiledRule,
  doc: PreparedDocument,
): ApplicabilityVerdict {
  // Rules that need a live website scan can never be decided from a document.
  if (rule.applicability === 'REQUIRES_LIVE_SCAN') {
    return {
      applicable: false,
      reason:
        'This check requires a live website behaviour scan (cookies, trackers and third-party scripts). ' +
        'This assessment analysed an uploaded document only, so the rule is excluded from scoring.',
      matchedTriggers: [],
    };
  }

  if (rule.applicability === 'ALWAYS') {
    return { applicable: true, reason: null, matchedTriggers: [] };
  }

  // CONDITIONAL — the obligation only bites if the document shows it is engaged.
  const matched: string[] = [];
  for (let i = 0; i < rule.compiled.applicabilityTriggers.length; i += 1) {
    const re = rule.compiled.applicabilityTriggers[i];
    if (!re) continue;
    const hit = doc.text.match(re);
    if (hit?.[0]) matched.push(hit[0].trim());
  }

  const needed = REQUIRES_TWO_SIGNALS.has(rule.category) ? 2 : 1;

  // A second corroborating signal can come from a distinct trigger match or
  // from an anchor sentence, which is a much stronger indication.
  const anchorHit = rule.compiled.anchors.some((re) => doc.sentences.some((s) => re.test(s.text)));
  const signals = matched.length + (anchorHit ? 1 : 0);

  if (signals >= needed) {
    return {
      applicable: true,
      reason: `Triggered by content in the document${matched.length ? `: ${unique(matched).slice(0, 4).join(', ')}` : ''}.`,
      matchedTriggers: unique(matched),
    };
  }

  return {
    applicable: false,
    reason:
      matched.length > 0
        ? `Only weak or isolated signals for this conditional obligation were found${
            matched.length ? ` (${unique(matched).slice(0, 3).join(', ')})` : ''
          }, which is not enough to establish that it applies. Excluded from scoring.`
        : 'Nothing in the document triggers this conditional obligation, so it has been excluded from scoring.',
    matchedTriggers: unique(matched),
  };
}

function unique(values: string[]): string[] {
  return [...new Set(values.map((v) => v.toLowerCase()))];
}
