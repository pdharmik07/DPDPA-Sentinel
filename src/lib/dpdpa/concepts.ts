/**
 * Privacy-concept lexicon used by the NLP/keyword dashboard.
 *
 * Separate from the requirement ontology on purpose: this layer answers
 * "what is this document talking about?" while the requirement layer answers
 * "does it satisfy the obligation?".
 */
export interface ConceptDef {
  id: string;
  label: string;
  description: string;
  patterns: RegExp[];
  /** Occurrences needed before the concept counts as firmly present. */
  strongAt: number;
}

export const CONCEPTS: ConceptDef[] = [
  {
    id: 'personal_data',
    label: 'Personal Data',
    description: 'Any data about an identifiable individual.',
    patterns: [/\bpersonal\s+(data|information)\b/gi, /\bpersonally\s+identifiable\b/gi, /\bpii\b/gi],
    strongAt: 6,
  },
  {
    id: 'data_principal',
    label: 'Data Principal',
    description: 'The individual to whom the personal data relates.',
    patterns: [/\bdata\s+principals?\b/gi, /\bdata\s+subjects?\b/gi],
    strongAt: 2,
  },
  {
    id: 'data_fiduciary',
    label: 'Data Fiduciary',
    description: 'The entity determining the purpose and means of processing.',
    patterns: [/\bdata\s+fiduciar(y|ies)\b/gi, /\bdata\s+controllers?\b/gi],
    strongAt: 2,
  },
  {
    id: 'consent',
    label: 'Consent',
    description: 'Free, specific, informed and unambiguous agreement to processing.',
    patterns: [/\bconsent\b/gi, /\bopt[- ]?in\b/gi],
    strongAt: 5,
  },
  {
    id: 'notice',
    label: 'Notice',
    description: 'The disclosure accompanying every request for consent.',
    patterns: [/\bnotice\b/gi, /\bprivacy\s+(policy|statement)\b/gi, /\binform(ed|ation about)\b/gi],
    strongAt: 4,
  },
  {
    id: 'purpose_limitation',
    label: 'Purpose Limitation',
    description: 'Processing confined to the purpose consented to.',
    patterns: [/\bpurpose\b/gi, /\blawful\s+purpose\b/gi, /\bpurpose\s+limitation\b/gi],
    strongAt: 5,
  },
  {
    id: 'data_minimisation',
    label: 'Data Minimisation',
    description: 'Collecting no more than the purpose requires.',
    patterns: [/\bminimi[sz]ation\b/gi, /\bonly\s+(collect|the\s+(data|information))\b/gi, /\bnecessary\b/gi],
    strongAt: 3,
  },
  {
    id: 'data_security',
    label: 'Data Security',
    description: 'Reasonable technical and organisational safeguards.',
    patterns: [/\bsecurity\b/gi, /\bencrypt\w*/gi, /\bsafeguards?\b/gi, /\bfirewall\b/gi, /\baccess\s+control\b/gi],
    strongAt: 5,
  },
  {
    id: 'data_retention',
    label: 'Data Retention',
    description: 'How long personal data is kept before erasure.',
    patterns: [/\bretention\b/gi, /\bretain\w*/gi, /\bhow\s+long\b/gi, /\bstorage\s+period\b/gi],
    strongAt: 3,
  },
  {
    id: 'data_sharing',
    label: 'Data Sharing',
    description: 'Disclosure of personal data to third parties or processors.',
    patterns: [/\bshar(e|ed|ing)\b/gi, /\bdisclos\w*/gi, /\bthird\s+part(y|ies)\b/gi, /\bservice\s+providers?\b/gi],
    strongAt: 4,
  },
  {
    id: 'data_processing',
    label: 'Data Processing',
    description: 'Any operation performed on personal data.',
    patterns: [/\bprocess(ing|ed|es)?\b/gi, /\bdata\s+processors?\b/gi],
    strongAt: 6,
  },
  {
    id: 'data_breach',
    label: 'Data Breach',
    description: 'Unauthorised access, disclosure or loss of personal data.',
    patterns: [/\bbreach\w*/gi, /\bsecurity\s+incident\b/gi, /\bunauthori[sz]ed\s+access\b/gi],
    strongAt: 2,
  },
  {
    id: 'grievance',
    label: 'Grievance Redressal',
    description: 'A published route for complaints about processing.',
    patterns: [/\bgrievance\w*/gi, /\bcomplaints?\b/gi, /\bredressal\b/gi, /\bgrievance\s+officer\b/gi],
    strongAt: 2,
  },
  {
    id: 'user_rights',
    label: 'User Rights',
    description: 'Access, correction, erasure and nomination rights.',
    patterns: [/\byour\s+rights?\b/gi, /\bright\s+to\s+\w+/gi, /\bdata\s+principal\s+rights?\b/gi],
    strongAt: 3,
  },
  {
    id: 'children_data',
    label: "Children's Data",
    description: 'Processing personal data of persons under 18.',
    patterns: [/\bchild(ren)?\b/gi, /\bminors?\b/gi, /\bparent(al)?\b/gi, /\bguardian\b/gi],
    strongAt: 3,
  },
  {
    id: 'cross_border',
    label: 'Cross-Border Transfer',
    description: 'Processing or storage of personal data outside India.',
    patterns: [/\boutside\s+india\b/gi, /\bcross[- ]border\b/gi, /\binternational\s+transfer\b/gi, /\boverseas\b/gi],
    strongAt: 2,
  },
  {
    id: 'consent_withdrawal',
    label: 'Withdrawal of Consent',
    description: 'The ability to take consent back at any time.',
    patterns: [/\bwithdraw\w*/gi, /\brevoke\b/gi, /\bopt[- ]?out\b/gi, /\bunsubscribe\b/gi],
    strongAt: 2,
  },
  {
    id: 'contact_information',
    label: 'Contact Information',
    description: 'A reachable channel for privacy queries.',
    patterns: [/\b[\w.+-]+@[\w-]+\.[\w.]{2,}\b/g, /\bcontact\s+us\b/gi, /(\+?\d[\d\s().-]{8,}\d)/g],
    strongAt: 2,
  },
];
