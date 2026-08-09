import type { Category, CategoryId } from './types';

export const CATEGORIES: Category[] = [
  {
    id: 'notice',
    label: 'Notice & Transparency',
    blurb: 'Whether the policy tells the Data Principal what is collected, why, and by whom.',
  },
  {
    id: 'consent',
    label: 'Consent',
    blurb: 'Free, specific, informed and unconditional consent — and the ability to take it back.',
  },
  {
    id: 'data_handling',
    label: 'Data Handling',
    blurb: 'Purpose limitation, minimisation, retention, erasure, sharing and transfers.',
  },
  {
    id: 'security',
    label: 'Security',
    blurb: 'Reasonable safeguards and personal data breach obligations.',
  },
  {
    id: 'rights',
    label: 'User Rights',
    blurb: 'Access, correction, erasure, nomination and the right to grievance redressal.',
  },
  {
    id: 'grievance',
    label: 'Grievance Redressal',
    blurb: 'A reachable, named channel for complaints and the Board escalation route.',
  },
  {
    id: 'children',
    label: "Children's Data",
    blurb: 'Verifiable parental consent and the ban on tracking or targeting children.',
  },
  {
    id: 'governance',
    label: 'Governance',
    blurb: 'Data Fiduciary accountability, processors, and Significant Data Fiduciary duties.',
  },
];

export const CATEGORY_LABEL: Record<CategoryId, string> = CATEGORIES.reduce(
  (acc, c) => ({ ...acc, [c.id]: c.label }),
  {} as Record<CategoryId, string>,
);
