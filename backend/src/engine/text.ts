/**
 * Text segmentation and linguistic cue detection.
 *
 * Ported from the original browser engine (src/lib/dpdpa/text.ts). The cue
 * lists are unchanged — they were tuned against real privacy policies and the
 * carve-outs below exist because of specific false positives found there.
 *
 * The one addition is paragraph tracking: every sentence now carries the index
 * of the paragraph it came from, so evidence can be shown in context.
 */

import type { PreparedDocument, Sentence } from './types.js';

/**
 * Words that flip the meaning of a clause. A sentence that matches a rule but
 * is negated is evidence *against* compliance, not for it.
 */
const NEGATION_CUES: RegExp[] = [
  /\bdo(es)?\s+not\b/i,
  /\bdid\s+not\b/i,
  /\bwill\s+not\b/i,
  /\bshall\s+not\b/i,
  /\bcannot\b/i,
  /\bcan'?t\b/i,
  /\bwon'?t\b/i,
  /\bdon'?t\b/i,
  /\bno\s+(right|mechanism|obligation|option|provision|way|facility|process)\b/i,
  /\bnot\s+(be\s+)?(provided?|offered?|available|possible|permitted|entitled|obliged)\b/i,
  /\bwithout\s+(any\s+)?(notice|consent|obligation)\b/i,
  /\bnever\b/i,
  /\bunable\s+to\b/i,
];

/**
 * Hedges make a commitment non-binding ("we may delete your data"). They do not
 * void a clause but they cap how much credit it can earn.
 */
const HEDGE_CUES: RegExp[] = [
  // Only the *fiduciary's* "may" hedges an obligation. "You may withdraw your
  // consent" grants the Data Principal a right — treating that as a hedge was
  // marking correctly-drafted rights clauses as non-compliant.
  /\b(we|the\s+company|the\s+organi[sz]ation|it)\s+(may|might|could)\b/i,
  /\bmay\s+(be\s+)?(retain|share|disclose|process|collect|transfer|use)\w*\b/i,
  /\bgenerally\b/i,
  /\btypically\b/i,
  /\busually\b/i,
  /\bwhere\s+(feasible|possible|practicable|appropriate|required)\b/i,
  /\bas\s+(applicable|appropriate|deemed\s+necessary|we\s+deem)\b/i,
  /\bat\s+(our|its)\s+(sole\s+)?discretion\b/i,
  /\bfrom\s+time\s+to\s+time\b/i,
  /\bendeavou?r\b/i,
  /\bstrive\b/i,
  /\bseek\s+to\b/i,
  /\breasonable\s+efforts?\b/i,
];

/**
 * Negation cues that are *not* negations of the obligation — a policy saying
 * "we do not sell your data" or "we do not track children" is a commitment.
 * Without this carve-out the engine would punish the strongest clauses.
 */
const POSITIVE_PROHIBITIONS: RegExp[] = [
  // "We do not undertake any tracking of children" is the strongest possible
  // clause for a prohibition-shaped rule. The verb list must therefore cover the
  // ways a policy commits to NOT doing something, not just "sell" and "share" —
  // an under-inclusive list makes the engine fail exactly the best-drafted
  // policies.
  /\b(do(es)?\s+not|will\s+not|shall\s+not|never|no\s+longer)\s+(?:\w+\s+){0,2}?(sell|rent|trade|share|disclose|track|monitor|target|use|undertake|serve|engage|conduct|perform|carry|collect|process|profile|advertise|display|permit|allow|retain|transfer|bundle|condition|make|require|repurpose|resell|store)\b/i,
  /\bno\s+(personal\s+data|data|information)\s+is\s+(sold|rented|traded|shared|disclosed|transferred)\b/i,
  /\bnot\s+knowingly\b/i,
  // "Nothing is pre-selected", "none of your data is sold"
  /\b(nothing|none)\b[^.]{0,40}\b(is|are|will\s+be)\b/i,
];

export function hasNegation(sentence: string): boolean {
  if (POSITIVE_PROHIBITIONS.some((p) => p.test(sentence))) return false;
  return NEGATION_CUES.some((p) => p.test(sentence));
}

export function hasHedging(sentence: string): boolean {
  return HEDGE_CUES.some((p) => p.test(sentence));
}

const ABBREVIATIONS =
  /\b(?:No|Nos|Mr|Mrs|Ms|Dr|Prof|Inc|Ltd|Pvt|Co|St|vs|etc|e\.g|i\.e|approx|Sec|Art)\.$/i;

/** Sentence splitter that survives the abbreviation-heavy prose in legal text. */
export function splitSentences(text: string): string[] {
  const normalised = text.replace(/\s+/g, ' ').trim();
  if (!normalised) return [];

  const rough = normalised.split(/(?<=[.!?;])\s+(?=[A-Z(“"'\d])/);
  const merged: string[] = [];

  for (const piece of rough) {
    const previous = merged[merged.length - 1];
    if (previous && ABBREVIATIONS.test(previous)) {
      merged[merged.length - 1] = `${previous} ${piece}`;
      continue;
    }
    // Sub-split very long run-on sentences on bullet-ish separators so evidence
    // snippets stay readable in the UI.
    if (piece.length > 420) {
      merged.push(...piece.split(/(?<=[;•])\s+/).filter(Boolean));
    } else {
      merged.push(piece);
    }
  }

  return merged.map((s) => s.trim()).filter((s) => s.length > 2);
}

export function splitParagraphs(text: string): string[] {
  return text
    .split(/\n\s*\n+/)
    .map((p) => p.replace(/\s+/g, ' ').trim())
    .filter((p) => p.length > 0);
}

/**
 * Heading detection: short standalone lines that are numbered, all-caps, or
 * title-case without terminal punctuation.
 */
export function detectSections(text: string): string[] {
  const lines = text.split(/\r?\n/).map((l) => l.trim());
  const sections: string[] = [];

  for (const line of lines) {
    if (line.length < 3 || line.length > 90) continue;
    if (/[.,;:]$/.test(line)) continue;

    const words = line.split(/\s+/);
    if (words.length > 12) continue;

    const numbered = /^(\d+(\.\d+)*[.)]?|[IVXLC]+[.)]|[A-Z][.)])\s+\S/.test(line);
    const allCaps = /^[A-Z0-9][A-Z0-9\s&'’/,-]{2,}$/.test(line) && /[A-Z]{3,}/.test(line);
    const titleCase =
      words.length <= 8 && words.filter((w) => /^[A-Z]/.test(w)).length >= Math.ceil(words.length * 0.6);

    if (numbered || allCaps || titleCase) sections.push(line);
  }

  return sections;
}

export function countWords(text: string): number {
  const m = text.match(/\b[\w’'-]+\b/g);
  return m ? m.length : 0;
}

/**
 * Normalises raw extracted text: strips control characters, collapses runaway
 * whitespace, repairs hyphenated line breaks from PDF extraction, and keeps
 * paragraph boundaries intact.
 */
export function normalizeText(raw: string): string {
  return (
    raw
      .replace(/\r\n?/g, '\n')
      // Strip control characters, keeping \n (000A) and \t (0009).
      // eslint-disable-next-line no-control-regex
      .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '')
      // Non-breaking / narrow spaces -> ordinary space.
      .replace(/[\u00A0\u2007\u202F]/g, ' ')
      // Zero-width characters and BOM -> removed.
      .replace(/[\u200B-\u200D\uFEFF]/g, '')
      // "informa-\ntion" -> "information"
      .replace(/(\w)-\n(\w)/g, '$1$2')
      .replace(/[ \t]+/g, ' ')
      .replace(/ *\n */g, '\n')
      .replace(/\n{3,}/g, '\n\n')
      .trim()
  );
}

/**
 * Full preprocessing pass: normalise, split into paragraphs, then split each
 * paragraph into sentences while remembering which paragraph each came from.
 */
export function prepareDocument(raw: string): PreparedDocument {
  const text = normalizeText(raw);
  const paragraphs = splitParagraphs(text);

  const sentences: Sentence[] = [];
  paragraphs.forEach((para, paraIndex) => {
    for (const s of splitSentences(para)) {
      sentences.push({ index: sentences.length, text: s, paragraph: paraIndex });
    }
  });

  // A document with no blank lines yields one giant paragraph; fall back to
  // splitting the whole text so sentence segmentation still works.
  if (sentences.length === 0 && text) {
    splitSentences(text).forEach((s, i) => sentences.push({ index: i, text: s, paragraph: 0 }));
  }

  return {
    text,
    sentences,
    paragraphs,
    sections: detectSections(text),
    words: countWords(text),
    characters: text.length,
  };
}
