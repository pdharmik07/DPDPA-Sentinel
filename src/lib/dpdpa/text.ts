/** Lightweight text segmentation + linguistic cues used by the analyzer. */

/**
 * Words that flip the meaning of a clause. The proposal's "conservative bias"
 * rule uses these: a sentence that matches a requirement but is negated is
 * evidence *against* compliance, not for it.
 */
const NEGATION_CUES = [
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
 * void the clause but they cap how much credit it can earn.
 */
const HEDGE_CUES = [
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
const POSITIVE_PROHIBITIONS = [
  /\b(do(es)?\s+not|will\s+not|shall\s+not|never)\s+(sell|rent|trade|share|disclose|track|monitor|target|use)\b/i,
  /\bno\s+(personal\s+data|data|information)\s+is\s+(sold|rented|traded)\b/i,
  /\bnot\s+knowingly\b/i,
];

export function hasNegation(sentence: string): boolean {
  if (POSITIVE_PROHIBITIONS.some((p) => p.test(sentence))) return false;
  return NEGATION_CUES.some((p) => p.test(sentence));
}

export function hasHedging(sentence: string): boolean {
  return HEDGE_CUES.some((p) => p.test(sentence));
}

const ABBREVIATIONS = /\b(?:No|Nos|Mr|Mrs|Ms|Dr|Prof|Inc|Ltd|Pvt|Co|St|vs|etc|e\.g|i\.e|approx|Sec|Art)\.$/i;

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
 * title-case without terminal punctuation. Used for the "sections detected" stat.
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
    const allCaps = /^[A-Z0-9][A-Z0-9\s&/'’(),.-]{3,}$/.test(line) && /[A-Z]{3}/.test(line);
    const titleCase =
      words.length >= 2 &&
      words.length <= 9 &&
      words.filter((w) => /^[A-Z]/.test(w)).length / words.length >= 0.6;

    if (numbered || allCaps || titleCase) sections.push(line);
  }

  return Array.from(new Set(sections));
}

export function countWords(text: string): number {
  const matches = text.match(/\b[\p{L}\p{N}][\p{L}\p{N}'’.-]*\b/gu);
  return matches ? matches.length : 0;
}
