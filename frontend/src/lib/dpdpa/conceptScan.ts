/**
 * Privacy-concept detection for the "what is this document talking about?"
 * panel.
 *
 * Extracted from the retired browser rule engine when analysis moved server
 * side. This layer is still computed in the browser, from the extracted text
 * the backend returns — a real analysis of the real document, not placeholder
 * data. Keeping it here let the 26-rule local ontology be deleted.
 */

import { CONCEPTS } from './concepts';
import type { ConceptFinding } from './types';
import { clamp } from '../utils';

export function analyzeConcepts(text: string, sentences: string[]): ConceptFinding[] {
  return CONCEPTS.map((concept) => {
    let frequency = 0;
    for (const pattern of concept.patterns) {
      const re = new RegExp(pattern.source, pattern.flags.includes('g') ? pattern.flags : `${pattern.flags}g`);
      frequency += (text.match(re) ?? []).length;
    }

    const sample = sentences.find((s) =>
      concept.patterns.some((p) => new RegExp(p.source, p.flags.replace('g', '')).test(s)),
    );

    const ratio = frequency / concept.strongAt;
    // Saturating curve: the 1st and 2nd hits move confidence far more than the 20th.
    const confidence = frequency === 0 ? 0 : clamp(0.42 + 0.5 * (1 - Math.exp(-1.15 * ratio)), 0, 0.98);

    const detected: ConceptFinding['detected'] =
      frequency === 0 ? 'no' : confidence >= 0.72 ? 'yes' : 'weak';

    return {
      id: concept.id,
      label: concept.label,
      description: concept.description,
      frequency,
      confidence,
      detected,
      sampleSentence: sample,
    };
  }).sort((a, b) => b.confidence - a.confidence || b.frequency - a.frequency);
}
