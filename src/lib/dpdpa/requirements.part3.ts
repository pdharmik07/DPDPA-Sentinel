import type { Requirement } from './types';

/** Grievance, children's data and governance clause-categories (DPDPA ss. 8–10, 13, 15). */
export const REQUIREMENTS_PART3: Requirement[] = [
  {
    id: 'grievance_redressal',
    code: 'DPDPA-13',
    title: 'Grievance Redressal Mechanism',
    category: 'grievance',
    section: 'Section 13',
    weightClass: 'mandatory',
    summary:
      'Every Data Fiduciary must publish a readily available means of grievance redressal and respond within the prescribed period.',
    whyItMatters:
      'A Data Principal must exhaust the Fiduciary\'s grievance route before approaching the Board. No published route means the individual is left with nowhere to go.',
    anchors: [
      /\bgrievance\b[^.]{0,80}\b(redressal|officer|mechanism|procedure|process|contact|raise|lodge|submit)\b/i,
      /\b(grievance|complaint)s?\s+(officer|redressal|cell|team|channel)\b/i,
      /\b(lodge|raise|submit|file|register)\b[^.]{0,50}\b(a\s+)?(grievance|complaint)\b/i,
    ],
    supporting: [/\bgrievance\b/i, /\bcomplaint\b/i, /\bredressal\b/i, /\bombuds\w*\b/i],
    specifics: [
      {
        label: 'Names a Grievance Officer / DPO',
        pattern:
          /\b(grievance\s+officer|data\s+protection\s+officer|dpo|nodal\s+officer|privacy\s+officer)\b/i,
      },
      {
        label: 'Gives contact details',
        pattern: /\b([\w.+-]+@[\w-]+\.[\w.]+|\+?\d[\d\s-]{7,}|postal\s+address)\b/i,
      },
      {
        label: 'States a response timeline',
        pattern: /\b(within\s+)?\d+\s*(business\s+|working\s+)?(days?|hours?|weeks?)\b/i,
      },
    ],
    recommendation:
      'Publish a named Grievance Officer with a direct email address and a committed response window, so the Section 13 route is genuinely "readily available".',
    suggestedLanguage:
      '"If you have any grievance about how we process your personal data, you may contact our Grievance Officer: [Name], [Designation], [Company], [Postal Address], grievance@[company].in, +91-XXXXXXXXXX. We acknowledge every grievance within 48 hours and resolve it within 30 days, as required under Section 13 of the DPDPA, 2023."',
  },
  {
    id: 'board_escalation',
    code: 'DPDPA-13.3',
    title: 'Escalation to the Data Protection Board',
    category: 'grievance',
    section: 'Section 13(3), Chapter V',
    weightClass: 'recommended',
    summary:
      'Where a grievance is not resolved, the Data Principal may complain to the Data Protection Board of India.',
    whyItMatters:
      'Telling users about the Board is a transparency signal, and it demonstrates the Fiduciary understands the enforcement structure it sits under.',
    anchors: [
      /\bdata\s+protection\s+board\b/i,
      /\b(complain|approach|escalat|appeal)\w*\b[^.]{0,70}\b(board|regulator|authority)\b/i,
      /\bif\b[^.]{0,80}\b(not\s+(satisfied|resolved)|unresolved|dissatisfied)\b[^.]{0,80}\b(board|authority|regulator)\b/i,
    ],
    supporting: [/\bboard\s+of\s+india\b/i, /\bescalat\w+\b/i, /\bappeal\b/i],
    specifics: [
      { label: 'Names the Data Protection Board', pattern: /\bdata\s+protection\s+board\b/i },
      {
        label: 'Explains when to escalate',
        pattern: /\b(not\s+(satisfied|resolved)|unresolved|dissatisfied|fail(s|ed)?\s+to)\b/i,
      },
    ],
    recommendation:
      'State that a Data Principal who is unsatisfied with the outcome of a grievance may complain to the Data Protection Board of India under Chapter V of the Act.',
    suggestedLanguage:
      '"If your grievance is not resolved to your satisfaction, you may register a complaint with the Data Protection Board of India in the manner provided under Chapter V of the DPDPA, 2023."',
  },
  {
    id: 'children_consent',
    code: 'DPDPA-9.1',
    title: "Children's Data — Verifiable Parental Consent",
    category: 'children',
    section: 'Section 9(1)',
    weightClass: 'conditional',
    summary:
      'Before processing the personal data of a child (under 18) or a person with a disability who has a lawful guardian, verifiable consent of the parent or guardian must be obtained.',
    whyItMatters:
      'India sets the age of a child at 18 — far higher than most jurisdictions — so policies adapted from foreign templates routinely under-protect Indian minors.',
    anchors: [
      /\b(child(ren)?|minor)s?\b[^.]{0,100}\b(parent(al)?|guardian)\b[^.]{0,60}\bconsent\b/i,
      /\bverifiable\s+(parental\s+|guardian\s+)?consent\b/i,
      /\b(under|below)\s+(the\s+age\s+of\s+)?(18|eighteen)\b/i,
      /\bchild(ren)?'?s?\s+(personal\s+)?(data|information|privacy)\b/i,
    ],
    supporting: [/\bchild(ren)?\b/i, /\bminor\b/i, /\bparent(al)?\b/i, /\bguardian\b/i, /\bage\b/i],
    applicabilityTriggers: [
      /\b(child(ren)?|minor|under\s+(the\s+age\s+of\s+)?(13|16|18|eighteen)|parent(al)?|guardian|school|student|kids?|teen)\b/i,
    ],
    specifics: [
      { label: 'Uses the under-18 threshold', pattern: /\b(18|eighteen)\b/i },
      { label: 'Requires verifiable consent', pattern: /\bverifiab\w+\b/i },
      {
        label: 'Covers persons with disability / guardian',
        pattern: /\b(disabilit(y|ies)|lawful\s+guardian|person\s+with\s+disability)\b/i,
      },
      {
        label: 'Describes the verification method',
        pattern:
          /\b(verif\w+)\b[^.]{0,100}\b(id|identity|document|digilocker|token|virtual|otp|credential)\b/i,
      },
    ],
    recommendation:
      "Add a children's clause using India's under-18 threshold, describe how parental consent is verified, and extend the same protection to persons with disabilities who have a lawful guardian.",
    suggestedLanguage:
      '"We do not knowingly process the personal data of any person under 18 years of age without first obtaining verifiable consent from their parent or lawful guardian, as required under Section 9(1) of the DPDPA, 2023. Verification is carried out through [describe method, e.g. a government-issued virtual token or DigiLocker-based identity check]. The same protection applies to a person with a disability who has a lawful guardian."',
  },
  {
    id: 'children_tracking',
    code: 'DPDPA-9.3',
    title: "No Tracking or Targeted Advertising to Children",
    category: 'children',
    section: 'Section 9(2)–9(3)',
    weightClass: 'conditional',
    summary:
      'A Data Fiduciary must not undertake processing likely to cause detrimental effect on a child, nor track, behaviourally monitor, or direct targeted advertising at children.',
    whyItMatters:
      'This is an outright prohibition, not a consent-based permission — parental consent does not cure it.',
    anchors: [
      /\b(not|never|prohibit\w*|refrain)\b[^.]{0,90}\b(track|monitor|profil|target\w*\s+advertis|behavioural)\w*\b[^.]{0,60}\bchild/i,
      /\bchild(ren)?\b[^.]{0,90}\b(not\s+)?(tracked?|monitor\w*|targeted\s+advertis\w*|behavioural\s+monitoring)\b/i,
      /\bdetrimental\s+effect\b[^.]{0,60}\b(child|well[- ]being)\b/i,
    ],
    supporting: [
      /\btracking\b/i,
      /\btargeted\s+advertis\w+\b/i,
      /\bbehavioural\s+monitoring\b/i,
      /\bprofil(e|ing)\b/i,
    ],
    // Generic advertising/tracking vocabulary is not enough — this obligation is
    // only triggered where the document actually concerns children.
    applicabilityTriggers: [
      /\b(child(ren)?|minor|under\s+(the\s+age\s+of\s+)?(13|16|18|eighteen)|parental|guardian|kids?|teenager)\b/i,
    ],
    specifics: [
      { label: 'Prohibits tracking of children', pattern: /\btrack\w*\b/i },
      { label: 'Prohibits targeted advertising', pattern: /\btargeted\s+advertis\w+\b/i },
      {
        label: 'References detrimental effect',
        pattern: /\b(detrimental|harm\w*|well[- ]being)\b/i,
      },
    ],
    recommendation:
      "State plainly that children are never tracked, behaviourally monitored, or shown targeted advertising, and that no processing likely to harm a child's well-being is undertaken.",
    suggestedLanguage:
      '"We do not undertake any processing of personal data that is likely to cause a detrimental effect on the well-being of a child. We do not track or behaviourally monitor children, and we never direct targeted advertising at them, as prohibited by Sections 9(2) and 9(3) of the DPDPA, 2023."',
  },
  {
    id: 'fiduciary_identity',
    code: 'DPDPA-2.i',
    title: 'Data Fiduciary Identity & Contact Information',
    category: 'governance',
    section: 'Sections 2(i), 5, 13',
    weightClass: 'mandatory',
    summary:
      'The policy must identify the Data Fiduciary and provide a working contact point for privacy matters.',
    whyItMatters:
      'A Data Principal cannot exercise a single right against an entity they cannot name or reach.',
    anchors: [
      /\b([\w.+-]+@[\w-]+\.[\w.]+)\b/,
      /\b(contact\s+us|reach\s+(us|out)|get\s+in\s+touch)\b/i,
      /\b(registered\s+(office|address)|corporate\s+office|principal\s+place\s+of\s+business)\b/i,
      /\bdata\s+fiduciary\b/i,
    ],
    supporting: [/\bcontact\b/i, /\baddress\b/i, /\bemail\b/i, /\bphone|telephone|mobile\b/i],
    specifics: [
      { label: 'Email address present', pattern: /\b[\w.+-]+@[\w-]+\.[\w.]{2,}\b/ },
      { label: 'Postal address present', pattern: /\b(address|office|street|floor|pin\s*code|\b\d{6}\b)/i },
      { label: 'Phone number present', pattern: /(\+?\d[\d\s().-]{8,}\d)/ },
      {
        label: 'Uses DPDPA terminology',
        pattern: /\bdata\s+(fiduciary|principal|processor)\b/i,
      },
    ],
    recommendation:
      'Name the legal entity acting as Data Fiduciary along with its registered address, a privacy email address and a phone number.',
    suggestedLanguage:
      '"[Legal Entity Name] (CIN: [XXXXX]), having its registered office at [full postal address, PIN], is the Data Fiduciary responsible for your personal data. For any privacy matter, contact privacy@[company].in or +91-XXXXXXXXXX."',
  },
  {
    id: 'processor_obligations',
    code: 'DPDPA-8.2p',
    title: 'Data Processor Engagement Under Contract',
    category: 'governance',
    section: 'Section 8(2)',
    weightClass: 'recommended',
    summary:
      'A Data Fiduciary may engage a Data Processor only under a valid contract, and remains responsible for the processor\'s compliance.',
    whyItMatters:
      'Outsourcing processing does not outsource liability — the Fiduciary answers for its processors before the Board.',
    anchors: [
      /\bdata\s+processors?\b/i,
      /\b(valid\s+)?(contract|agreement|dpa)\b[^.]{0,90}\b(processor|vendor|service provider|sub[- ]processor)\b/i,
      /\b(processor|vendor|service provider)s?\b[^.]{0,90}\b(only\s+on\s+our\s+instructions?|bound\s+by|under\s+contract|contractual(ly)?)\b/i,
    ],
    supporting: [
      /\bprocessor\b/i,
      /\bsub[- ]?processor\b/i,
      /\bdata\s+processing\s+agreement\b/i,
      /\bcontractual\b/i,
    ],
    specifics: [
      { label: 'Uses the "Data Processor" term', pattern: /\bdata\s+processors?\b/i,},
      {
        label: 'Requires a written contract',
        pattern: /\b(written\s+)?(contract|agreement|dpa)\b/i,
      },
      {
        label: 'Processing limited to instructions',
        pattern: /\bonly\s+(on|in accordance with)\s+(our|the fiduciary'?s?)\s+instructions?\b/i,
      },
      {
        label: 'Retains Fiduciary responsibility',
        pattern: /\b(remain\w*|continue\w*)\s+(responsible|liable|accountable)\b/i,
      },
    ],
    recommendation:
      'State that every processor is engaged under a written contract limiting it to your documented instructions, and that you remain responsible for its compliance.',
    suggestedLanguage:
      '"Where we engage a Data Processor, we do so only under a valid written contract that limits the processor to processing personal data on our documented instructions, requires equivalent security safeguards, and prohibits onward sub-processing without our prior written approval. We remain responsible for compliance under Section 8(2) of the DPDPA, 2023."',
  },
  {
    id: 'significant_fiduciary',
    code: 'DPDPA-10',
    title: 'Significant Data Fiduciary Obligations',
    category: 'governance',
    section: 'Section 10',
    weightClass: 'conditional',
    summary:
      'A Significant Data Fiduciary must appoint an India-based Data Protection Officer, engage an independent data auditor, and carry out periodic Data Protection Impact Assessments and audits.',
    whyItMatters:
      'These duties attach on notification by the Central Government based on volume and sensitivity of data — organisations at scale need the structure documented in advance.',
    anchors: [
      /\bsignificant\s+data\s+fiduciary\b/i,
      /\bdata\s+protection\s+officer\b/i,
      /\bdata\s+protection\s+impact\s+assessment\b|\bdpia\b/i,
      /\b(independent\s+)?data\s+auditor\b/i,
    ],
    supporting: [
      /\bdpo\b/i,
      /\baudit(or|ing)?\b/i,
      /\bimpact\s+assessment\b/i,
      /\bperiodic\s+review\b/i,
    ],
    applicabilityTriggers: [
      /\b(significant\s+data\s+fiduciary|data\s+protection\s+officer|dpo|impact\s+assessment|dpia|data\s+auditor|large\s+(volume|scale)|millions?\s+of\s+users?|enterprise)\b/i,
    ],
    specifics: [
      { label: 'Appoints a Data Protection Officer', pattern: /\bdata\s+protection\s+officer|dpo\b/i },
      { label: 'DPO based in India', pattern: /\b(based|located|resident)\s+in\s+india\b/i },
      { label: 'Independent data auditor', pattern: /\b(independent\s+)?data\s+auditor\b/i },
      {
        label: 'Periodic DPIA / audit',
        pattern: /\b(periodic|annual|regular)\b[^.]{0,60}\b(audit|assessment|review)\b/i,
      },
    ],
    recommendation:
      'If the organisation is likely to be notified as a Significant Data Fiduciary, document the India-based DPO, the independent data auditor, and the DPIA and audit cadence.',
    suggestedLanguage:
      '"Where we are notified as a Significant Data Fiduciary under Section 10 of the DPDPA, 2023, we have appointed a Data Protection Officer based in India who reports to our Board, engaged an independent data auditor, and we conduct a Data Protection Impact Assessment and a data audit at least once every 12 months."',
  },
  {
    id: 'principal_duties',
    code: 'DPDPA-15',
    title: 'Duties of the Data Principal',
    category: 'governance',
    section: 'Section 15',
    weightClass: 'recommended',
    summary:
      'The Act places duties on the Data Principal too — notably not to impersonate, not to suppress material information, and not to file false or frivolous grievances.',
    whyItMatters:
      'Section 15 is another India-specific provision absent from GDPR templates; restating it shows the policy was written against the DPDPA itself.',
    anchors: [
      /\bdut(y|ies)\s+of\s+(the\s+)?data\s+principal\b/i,
      /\byour\s+(duties|responsibilities|obligations)\b/i,
      /\b(not\s+to\s+)?(impersonat\w+|false\s+(or\s+frivolous\s+)?(grievance|complaint)|suppress\w*\s+(any\s+)?material\s+information)\b/i,
    ],
    supporting: [/\bduties\b/i, /\bresponsibilit\w+\b/i, /\bfrivolous\b/i, /\bimpersonat\w+\b/i],
    specifics: [
      { label: 'Prohibits impersonation', pattern: /\bimpersonat\w+\b/i },
      {
        label: 'Prohibits false or frivolous grievances',
        pattern: /\b(false|frivolous)\b[^.]{0,40}\b(grievance|complaint)\b/i,
      },
      {
        label: 'Requires authentic information',
        pattern: /\b(authentic|accurate|genuine|true)\b[^.]{0,60}\b(information|data|details)\b/i,
      },
    ],
    recommendation:
      'Summarise the Section 15 duties so Data Principals understand their side of the arrangement — no impersonation, no suppression of material information, no false grievances.',
    suggestedLanguage:
      '"Under Section 15 of the DPDPA, 2023 you are required to comply with applicable law when exercising your rights, not to impersonate another person while providing personal data, not to suppress any material information when providing it for an official document, and not to register a false or frivolous grievance."',
  },
  {
    id: 'policy_updates',
    code: 'DPDPA-5.2',
    title: 'Policy Versioning & Change Notification',
    category: 'notice',
    section: 'Section 5(2)',
    weightClass: 'recommended',
    summary:
      'Changes to the notice must be communicated, and the Data Principal must be able to tell which version applies to them.',
    whyItMatters:
      'A policy with no effective date and no change process cannot evidence what a user was actually shown when they consented.',
    anchors: [
      /\b(last\s+(updated|revised|modified)|effective\s+(date|from)|version)\b/i,
      /\b(we\s+may\s+)?(update|revise|amend|modify|change)\b[^.]{0,70}\b(this\s+)?(policy|notice)\b/i,
      /\b(notify|inform|communicate)\b[^.]{0,80}\b(changes?|updates?|revisions?)\b/i,
    ],
    supporting: [/\bupdated?\b/i, /\brevis\w+\b/i, /\beffective\s+date\b/i, /\bversion\b/i],
    specifics: [
      {
        label: 'Shows an effective / updated date',
        pattern:
          /\b(last\s+(updated|revised|modified)|effective\s+(date|from))\b[^.]{0,40}\b(\d{1,2}\s*\w+\s*\d{4}|\d{4}|\d{1,2}[/-]\d{1,2}[/-]\d{2,4})/i,
      },
      {
        label: 'Commits to notifying changes',
        pattern: /\b(notify|inform|communicate|email|post)\b[^.]{0,70}\b(chang|updat|revis)\w*/i,
      },
      { label: 'Version identifier present', pattern: /\bversion\s*[:v]?\s*\d/i },
    ],
    recommendation:
      'Carry a visible effective date and version number, and commit to notifying Data Principals of material changes before they take effect.',
    suggestedLanguage:
      '"Version 2.1 — effective 1 January 2026. We review this Notice at least annually. Where we make a material change we will notify you by email and in-product at least 15 days before it takes effect, and where the change requires it we will seek fresh consent. Previous versions are archived at [link]."',
  },
];
