import type { Requirement } from './types';

/** Transfer, security, breach and Data Principal rights (DPDPA ss. 8, 11–14, 16). */
export const REQUIREMENTS_PART2: Requirement[] = [
  {
    id: 'cross_border',
    code: 'DPDPA-16',
    title: 'Cross-Border Data Transfer',
    category: 'data_handling',
    section: 'Section 16',
    weightClass: 'conditional',
    summary:
      'Personal data may be transferred outside India except to territories the Central Government restricts by notification.',
    whyItMatters:
      'If data leaves India the policy must say so. Silent offshore processing removes the Data Principal\'s ability to assess where their data actually sits.',
    anchors: [
      /\b(transfer|process|stor)\w*\b[^.]{0,80}\b(outside\s+india|cross[- ]border|international|another\s+countr|overseas|abroad)\b/i,
      /\b(cross[- ]border|international)\s+(data\s+)?transfers?\b/i,
      /\b(servers?|data\s+cent(re|er)s?)\b[^.]{0,60}\b(located|hosted|situated)\b[^.]{0,60}\b(outside|abroad|united states|singapore|europe)\b/i,
    ],
    supporting: [
      /\boutside\s+india\b/i,
      /\bcross[- ]border\b/i,
      /\binternational\s+transfer\b/i,
      /\boverseas\b/i,
    ],
    applicabilityTriggers: [
      /\b(outside\s+india|cross[- ]border|international|overseas|abroad|global|united states|singapore|europe|aws|azure|google cloud|foreign)\b/i,
    ],
    specifics: [
      {
        label: 'Names destination countries or regions',
        pattern:
          /\b(united states|usa|singapore|europe|european union|eu|uk|ireland|japan|australia|specified countr)\b/i,
      },
      {
        label: 'References the Section 16 restriction',
        pattern: /\b(restrict|notif(y|ied|ication)|permitted|central government|not(ified)? territor)\b/i,
      },
      {
        label: 'Applies safeguards to the transfer',
        pattern:
          /\b(safeguard|contractual|encrypt|equivalent protection|standard clauses)\b[^.]{0,80}\btransfer\b/i,
      },
    ],
    recommendation:
      'Disclose whether personal data is stored or processed outside India, name the destinations, and confirm no transfers are made to territories restricted by the Central Government under Section 16.',
    suggestedLanguage:
      '"Your personal data is primarily stored on servers located in India. Certain Data Processors we engage may process it in [United States, Singapore]. We do not transfer personal data to any country or territory notified as restricted by the Central Government under Section 16 of the DPDPA, 2023, and all such transfers are protected by contractual safeguards and encryption in transit."',
  },
  {
    id: 'security_safeguards',
    code: 'DPDPA-8.5',
    title: 'Reasonable Security Safeguards',
    category: 'security',
    section: 'Section 8(5)',
    weightClass: 'mandatory',
    summary:
      'A Data Fiduciary must take reasonable security safeguards to prevent personal data breaches.',
    whyItMatters:
      'Section 8(5) is an absolute duty — it applies whether or not a breach ever happens, and its absence is the single largest penalty exposure under the Act (up to ₹250 crore).',
    anchors: [
      /\b(reasonable|appropriate|technical and organi[sz]ational)\s+(security\s+)?(safeguards?|measures?|controls?)\b/i,
      /\b(we|company)\s+(implement|maintain|employ|deploy|use|adopt)s?\b[^.]{0,70}\b(security|encryption|safeguards?|measures?)\b/i,
      /\b(encrypt(ion|ed)?|ssl|tls|https|firewall|access controls?|multi[- ]factor)\b/i,
      /\bprotect\b[^.]{0,60}\b(unauthori[sz]ed|accidental)\s+(access|disclosure|loss|use)\b/i,
    ],
    supporting: [
      /\bsecurity\b/i,
      /\bsafeguard\b/i,
      /\bencrypt\w*\b/i,
      /\bconfidential\w*\b/i,
      /\bprotect\w*\b/i,
    ],
    specifics: [
      { label: 'Encryption named', pattern: /\b(encrypt\w*|ssl|tls|https|at rest|in transit)\b/i },
      {
        label: 'Access control named',
        pattern:
          /\b(access\s+control|role[- ]based|least\s+privilege|authenticat\w+|multi[- ]factor|2fa)\b/i,
      },
      {
        label: 'Organisational measures named',
        pattern:
          /\b(training|audit|penetration\s+test|vulnerability|monitoring|incident\s+response|iso\s*27001|soc\s*2|policy review)\b/i,
      },
      {
        label: 'Processor safeguards imposed',
        pattern: /\b(processor|vendor|third[- ]part)\w*\b[^.]{0,80}\b(security|safeguard|encrypt)/i,
      },
    ],
    recommendation:
      'Replace generic assurances such as "we take security seriously" with the actual controls: encryption in transit and at rest, role-based access control, logging and monitoring, periodic testing, and staff training.',
    suggestedLanguage:
      '"We implement reasonable security safeguards under Section 8(5) of the DPDPA, 2023, including TLS 1.3 encryption in transit and AES-256 encryption at rest, role-based access control on the principle of least privilege, multi-factor authentication for administrative access, centralised logging and monitoring, annual VAPT by an independent assessor, and mandatory privacy training for all personnel with access to personal data."',
  },
  {
    id: 'breach_notification',
    code: 'DPDPA-8.6',
    title: 'Personal Data Breach Notification',
    category: 'security',
    section: 'Section 8(6)',
    weightClass: 'mandatory',
    summary:
      'In the event of a personal data breach, the Data Fiduciary must notify the Data Protection Board of India and each affected Data Principal.',
    whyItMatters:
      'The duty to notify both the Board and every affected individual is unconditional under the Act — there is no "risk of harm" threshold to hide behind as under some other regimes.',
    anchors: [
      /\b(data\s+)?breach\b[^.]{0,90}\b(notif(y|ied|ication)|inform|report|intimate)\b/i,
      /\b(notif(y|ied|ication)|inform|report)\b[^.]{0,90}\b(data\s+)?breach\b/i,
      /\b(security|data)\s+(incident|breach)\b[^.]{0,80}\b(board|authorit|affected|users?|you)\b/i,
      /\bdata\s+protection\s+board\b/i,
    ],
    supporting: [
      /\bbreach\b/i,
      /\bincident\b/i,
      /\bunauthori[sz]ed\s+(access|disclosure)\b/i,
      /\bcompromis\w+\b/i,
    ],
    specifics: [
      {
        label: 'Notifies the Data Protection Board',
        pattern: /\b(data\s+protection\s+board|the\s+board|regulator|authorit(y|ies))\b/i,
      },
      {
        label: 'Notifies affected Data Principals',
        pattern:
          /\b(notif(y|ied)|inform|intimate|alert)\b[^.]{0,70}\b(you|affected|users?|data principals?|individuals?)\b/i,
      },
      {
        label: 'States a notification timeline',
        pattern: /\b(without\s+undue\s+delay|\d+\s*(hours?|days?)|promptly|immediately)\b/i,
      },
      {
        label: 'Describes remedial steps',
        pattern:
          /\b(remedial|mitigat\w+|contain\w+|investigat\w+|steps\s+(taken|we))\b/i,
      },
    ],
    recommendation:
      'Add an explicit breach clause covering both notification routes — the Data Protection Board and every affected Data Principal — with a stated timeline and a summary of the incident response process.',
    suggestedLanguage:
      '"In the event of a personal data breach, we will notify the Data Protection Board of India and every affected Data Principal without undue delay and in any case within 72 hours of becoming aware of it, in the form and manner prescribed under Section 8(6) of the DPDPA, 2023. The notification will describe the nature and extent of the breach, its likely consequences, the remedial measures we have taken, and the contact point for further information."',
  },
  {
    id: 'data_accuracy',
    code: 'DPDPA-8.3',
    title: 'Accuracy & Completeness of Data',
    category: 'data_handling',
    section: 'Section 8(3)–8(4)',
    weightClass: 'recommended',
    summary:
      'Where personal data is used to make a decision affecting the Data Principal or is disclosed to another Fiduciary, it must be complete, accurate and consistent.',
    whyItMatters:
      'Decisions taken on stale or wrong data cause real harm to the individual, and the Act places the burden of accuracy squarely on the Fiduciary.',
    anchors: [
      /\b(accura(te|cy)|complete(ness)?|up[- ]to[- ]date|current)\b[^.]{0,80}\b(personal\s+)?(data|information)\b/i,
      /\b(ensure|maintain|keep)\b[^.]{0,60}\b(accura(te|cy)|up[- ]to[- ]date|correct)\b/i,
      /\b(data\s+)?quality\b[^.]{0,50}\b(personal\s+data|information)\b/i,
    ],
    supporting: [/\baccura(te|cy)\b/i, /\bup[- ]to[- ]date\b/i, /\bcomplete\b/i, /\bcorrect\b/i],
    specifics: [
      {
        label: 'Commits to accuracy for decisions',
        pattern: /\b(decision|affect\w*)\b[^.]{0,80}\b(accura|complete|consistent)/i,
      },
      {
        label: 'Asks the user to keep data current',
        pattern: /\b(you|please)\b[^.]{0,80}\b(update|inform us|keep.{0,20}current|notify us)\b/i,
      },
    ],
    recommendation:
      'Commit to keeping personal data accurate and consistent wherever it drives a decision about the individual or is shared onward, and tell users how to update their own records.',
    suggestedLanguage:
      '"Where your personal data is used to make a decision that affects you, or is disclosed to another Data Fiduciary, we take reasonable steps to ensure it is complete, accurate and consistent. You can review and update your details at any time from your account profile."',
  },
  {
    id: 'right_access',
    code: 'DPDPA-11',
    title: 'Right to Access Information',
    category: 'rights',
    section: 'Section 11',
    weightClass: 'mandatory',
    summary:
      'A Data Principal may obtain a summary of the personal data being processed, the processing activities, and the identities of other Fiduciaries with whom it has been shared.',
    whyItMatters:
      'Access is the right that makes every other right usable — an individual cannot correct or erase data whose existence they cannot confirm.',
    anchors: [
      /\bright\s+to\s+(access|obtain|request)\b[^.]{0,60}\b(information|data|summary|copy)\b/i,
      /\b(request|obtain|receive)\b[^.]{0,60}\b(a\s+)?(summary|copy|details)\b[^.]{0,60}\b(personal\s+)?(data|information)\b/i,
      /\byou\s+(have\s+the\s+right|may|can)\b[^.]{0,60}\baccess\b[^.]{0,50}\b(your\s+)?(personal\s+)?(data|information)\b/i,
    ],
    supporting: [/\bright\s+to\s+access\b/i, /\bsubject\s+access\b/i, /\byour\s+rights\b/i],
    specifics: [
      {
        label: 'Summary of data processed',
        pattern: /\b(summary|copy|list|details)\b[^.]{0,60}\b(personal\s+)?(data|information)\b/i,
      },
      {
        label: 'Identities of sharing recipients',
        pattern:
          /\b(identit(y|ies)|with\s+whom|recipients?)\b[^.]{0,70}\b(shared|disclosed|transferred)\b/i,
      },
      {
        label: 'Explains how to make the request',
        pattern: /\b(request|access)\b[^.]{0,100}\b(email|writing|contact|portal|form|account)\b/i,
      },
    ],
    recommendation:
      'Add a Section 11 access right: a summary of the data held, the processing activities, and the identity of every Fiduciary the data has been shared with — plus the exact channel for making the request.',
    suggestedLanguage:
      '"Under Section 11 of the DPDPA, 2023 you may request a summary of the personal data we process about you, the processing activities we undertake, and the identities of any other Data Fiduciaries with whom we have shared it. Write to privacy@[company].in and we will respond within 30 days."',
  },
  {
    id: 'right_correction',
    code: 'DPDPA-12',
    title: 'Right to Correction & Updating',
    category: 'rights',
    section: 'Section 12',
    weightClass: 'mandatory',
    summary:
      'A Data Principal may require correction, completion or updating of inaccurate or incomplete personal data.',
    whyItMatters:
      'Section 12 obliges the Fiduciary to act on a correction request, and to pass it on to anyone the data was shared with.',
    anchors: [
      /\bright\s+to\s+(correct|rectif|updat|complet)\w*\b/i,
      /\b(correct|rectify|update|amend|complete)\b[^.]{0,70}\b(your\s+)?(personal\s+)?(data|information|details)\b/i,
      /\byou\s+(may|can|have the right to)\b[^.]{0,50}\b(correct|update|amend|rectify)\b/i,
    ],
    supporting: [/\bcorrect(ion)?\b/i, /\bupdate\b/i, /\brectif\w+\b/i, /\bamend\b/i],
    specifics: [
      {
        label: 'Covers correction and completion',
        pattern: /\b(complet\w+|inaccurate|incomplete|outdated)\b/i,
      },
      {
        label: 'Explains how to request correction',
        pattern:
          /\b(correct|update|amend)\b[^.]{0,110}\b(email|writing|contact|settings|account|portal|form)\b/i,
      },
    ],
    recommendation:
      'State the Section 12 right to correction, completion and updating, give the channel for exercising it, and confirm corrections are propagated to recipients the data was shared with.',
    suggestedLanguage:
      '"Under Section 12 of the DPDPA, 2023 you may request that we correct inaccurate or misleading personal data, complete incomplete data, or update it. Most details can be changed directly in your account; for anything else write to privacy@[company].in. We will also inform every Data Fiduciary with whom we shared that data of the correction."',
  },
  {
    id: 'right_erasure',
    code: 'DPDPA-12.3',
    title: 'Right to Erasure',
    category: 'rights',
    section: 'Section 12(3)',
    weightClass: 'mandatory',
    summary:
      'A Data Principal may require erasure of their personal data unless retention is necessary for the specified purpose or for compliance with law.',
    whyItMatters:
      'Erasure is a distinct statutory right; a policy that offers only "account deactivation" does not satisfy it.',
    anchors: [
      /\bright\s+to\s+(eras(e|ure)|delet(e|ion)|be\s+forgotten)\b/i,
      /\b(request|ask)\b[^.]{0,60}\b(eras(e|ure)|delet(e|ion)|removal)\b[^.]{0,60}\b(your\s+)?(personal\s+)?(data|information|account)\b/i,
      /\byou\s+(may|can)\b[^.]{0,50}\b(delete|erase|remove)\b[^.]{0,50}\b(your\s+)?(data|account|information)\b/i,
    ],
    supporting: [/\beras(e|ure)\b/i, /\bdelet(e|ion)\b/i, /\bremov(e|al)\b/i],
    specifics: [
      {
        label: 'Explains how to request erasure',
        pattern:
          /\b(delete|erase|remov)\w*\b[^.]{0,110}\b(email|writing|contact|settings|account|portal|form|request)\b/i,
      },
      {
        label: 'States the legal retention exception',
        pattern: /\b(unless|except)\b[^.]{0,90}\b(law|legal|statut|regulat)\w*/i,
      },
      { label: 'States a response timeline', pattern: /\b\d+\s*(days?|hours?|weeks?)\b/i },
    ],
    recommendation:
      'Give erasure its own clause distinct from account closure, with the request channel, the response timeline, and the narrow legal grounds on which some data may be retained.',
    suggestedLanguage:
      '"Under Section 12(3) of the DPDPA, 2023 you may request erasure of your personal data. On receiving your request we will erase it within 30 days, except where continued retention is necessary for the specified purpose or is required under applicable law — in which case we will tell you which data was retained and why."',
  },
  {
    id: 'right_nomination',
    code: 'DPDPA-14',
    title: 'Right of Nomination',
    category: 'rights',
    section: 'Section 14',
    weightClass: 'recommended',
    summary:
      'A Data Principal may nominate another individual to exercise their rights in the event of death or incapacity.',
    whyItMatters:
      'Nomination is unique to the Indian Act — policies copy-pasted from GDPR templates almost always miss it, and it is an easy, visible win.',
    anchors: [
      /\bnominat(e|ion|ed)\b[^.]{0,90}\b(rights?|behalf|death|incapacit)\w*/i,
      /\bright\s+of\s+nomination\b/i,
      /\b(in\s+the\s+event\s+of\s+(your\s+)?(death|incapacity))\b/i,
    ],
    supporting: [/\bnominat\w+\b/i, /\blegal\s+heir\b/i, /\bincapacit\w+\b/i],
    specifics: [
      { label: 'Explicitly references nomination', pattern: /\bnominat\w+\b/i },
      { label: 'Covers death or incapacity', pattern: /\b(death|deceased|incapacit\w+)\b/i },
      {
        label: 'Explains how to nominate',
        pattern: /\bnominat\w+\b[^.]{0,110}\b(contact|email|writing|form|settings|account)\b/i,
      },
    ],
    recommendation:
      'Add a Section 14 nomination clause letting a Data Principal name someone to exercise their rights on death or incapacity, and describe how to register that nominee.',
    suggestedLanguage:
      '"Under Section 14 of the DPDPA, 2023 you may nominate any other individual to exercise your rights under the Act on your behalf in the event of your death or incapacity. To register or change a nominee, write to privacy@[company].in with the nominee\'s name and contact details."',
  },
];
