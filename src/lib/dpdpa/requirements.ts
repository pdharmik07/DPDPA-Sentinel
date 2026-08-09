import type { Requirement, WeightClass } from './types';
import { WEIGHTS } from './types';
import { REQUIREMENTS_PART1 } from './requirements.part1';
import { REQUIREMENTS_PART2 } from './requirements.part2';
import { REQUIREMENTS_PART3 } from './requirements.part3';

/**
 * The full DPDPA clause-category ontology the scanner tests against —
 * 26 categories spanning notice, consent, data handling, security,
 * Data Principal rights, grievance redressal, children's data and governance.
 */
export const REQUIREMENTS: Requirement[] = [
  ...REQUIREMENTS_PART1,
  ...REQUIREMENTS_PART2,
  ...REQUIREMENTS_PART3,
];

export const REQUIREMENT_BY_ID = new Map(REQUIREMENTS.map((r) => [r.id, r]));

export function weightOf(req: Requirement): number {
  return WEIGHTS[req.weightClass];
}

export const WEIGHT_CLASS_LABEL: Record<WeightClass, string> = {
  mandatory: 'Mandatory',
  conditional: 'Conditional',
  recommended: 'Recommended',
};

export const REQUIREMENT_COUNT = REQUIREMENTS.length;
