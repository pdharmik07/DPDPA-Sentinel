import type { Requirement } from './types';

/** Notice, transparency and consent clause-categories (DPDPA ss. 4–7). */
export const REQUIREMENTS_PART1: Requirement[] = [
  {
    id: 'notice',
    code: 'DPDPA-5.1',
    title: 'Notice of Collection',
    category: 'notice',
    section: 'Section 5(1)',
    weightClass: 'mandatory',
    summary:
      'Every request for consent must be accompanied by a notice describing the personal data sought and the purpose of processing.',
    whyItMatters:
      'Notice is the foundation of the Act. Without it, consent cannot be "informed", so every downstream processing activity built on that consent is exposed.',
    anchors: [
      /\b(this|our)\s+(privacy\s+)?(policy|notice|statement)\s+(describes|explains|sets out|informs|tells)/i,
      /\b(we|company|organi[sz]ation)\s+(collect|gather|obtain|receive)s?\b[^.]{0,80}\b(personal|information|data)\b/i,
      /\b(information|data|personal data)\s+(we|that we)\s+(collect|gather|process)/i,
      /\bcategories\s+of\s+(personal\s+)?(data|information)\s+(we\s+)?(collect|process)/i,
    ],
    supporting: [
      /\bprivacy\s+(policy|notice)\b/i,
      /\bwhat\s+(information|data)\s+we\s+collect\b/i,
      /\btypes?\s+of\s+(information|data)\b/i,
      /\bnotify|notice|inform(ed|ation about)\b/i,
    ],
    specifics: [
      {
        label: 'Identifies the data collected',
        pattern:
          /\b(name|e-?mail|phone|mobile|address|contact details|payment|location|device|IP address|identifier)\b/i,
      },
      {
        label: 'States the purpose of collection',
        pattern: /\b(purpose|in order to|so that|used to|for the purpose of)\b/i,
      },
      {
        label: 'Identifies the entity collecting',
        pattern:
          /\b(we are|our company|data fiduciary|controller|registered (office|address)|operated by)\b/i,
      },
    ],
    recommendation:
      'Open the policy with an itemised notice: exactly which categories of personal data are collected, the specific purpose of each, and the identity of the Data Fiduciary collecting them.',
    suggestedLanguage:
      '"This Notice is provided under Section 5 of the Digital Personal Data Protection Act, 2023. [Company Name], acting as the Data Fiduciary, collects the following categories of personal data: [name, email address, mobile number, ...]. Each category is collected for the specific purpose stated against it in the table below."',
  },
  {
    id: 'notice_language',
    code: 'DPDPA-5.3',
    title: 'Notice in Plain Language & Indian Languages',
    category: 'notice',
    section: 'Section 5(3)',
    weightClass: 'recommended',
    summary:
      'The notice must be available in English or any language in the Eighth Schedule to the Constitution, in clear and plain language.',
    whyItMatters:
      'A notice a Data Principal cannot read is not a notice. Indian-language availability is an express statutory requirement, not a nicety.',
    anchors: [
      /\b(plain|simple|clear|easy[- ]to[- ]understand)\s+(language|english|terms)\b/i,
      /\b(eighth\s+schedule|regional\s+languages?|indian\s+languages?)\b/i,
      /\b(available|provided|translated)\s+in\s+[^.]{0,40}\b(hindi|gujarati|marathi|tamil|telugu|bengali|kannada)\b/i,
    ],
    supporting: [
      /\blanguage\b/i,
      /\btranslat(e|ed|ion)\b/i,
      /\baccessib(le|ility)\b/i,
    ],
    specifics: [
      {
        label: 'Names available languages',
        pattern:
          /\b(hindi|gujarati|marathi|tamil|telugu|bengali|kannada|malayalam|punjabi|odia|assamese|urdu)\b/i,
      },
      { label: 'Commits to plain language', pattern: /\b(plain|simple|clear)\s+language\b/i },
    ],
    recommendation:
      'State that the notice is available in English and at least one Eighth Schedule language, and provide the link. Keep sentences short and avoid undefined legal jargon.',
    suggestedLanguage:
      '"This Notice is available in English and in Hindi, Gujarati and Marathi. You may access any version at [link]. We have written it in plain language so that you can understand it without legal assistance."',
  },
  {
    id: 'consent',
    code: 'DPDPA-6.1',
    title: 'Consent Mechanism',
    category: 'consent',
    section: 'Section 6(1)',
    weightClass: 'mandatory',
    summary:
      'Consent must be free, specific, informed, unconditional and unambiguous, given by a clear affirmative action, and limited to the data necessary for the stated purpose.',
    whyItMatters:
      'Consent is the primary lawful basis under the Act. Bundled, implied or pre-ticked consent is invalid, which makes the entire processing operation unlawful.',
    anchors: [
      /\b(your|obtain(ing)?|we obtain|we seek|provide (your|us with) )\s*consent\b/i,
      /\bconsent\s+(is|will be|shall be)\s+(obtained|taken|sought|required|requested)/i,
      /\b(by\s+(clicking|checking|ticking|submitting|registering|continuing))\b[^.]{0,60}\b(you\s+(consent|agree))/i,
      /\b(free|specific|informed|unconditional|unambiguous|explicit|affirmative)\s+consent\b/i,
    ],
    supporting: [
      /\bconsent\b/i,
      /\bopt[- ]?in\b/i,
      /\bagree(ment)?\s+to\s+(the\s+)?processing\b/i,
      /\bpermission\b/i,
    ],
    specifics: [
      {
        label: 'Requires a clear affirmative action',
        pattern:
          /\b(clear\s+affirmative|explicit|opt[- ]?in|tick|check\s+the\s+box|click\s+(accept|agree))\b/i,
      },
      { label: 'Consent is purpose-specific', pattern: /\bconsent\b[^.]{0,80}\bpurpose\b/i },
      {
        label: 'Names an alternate lawful basis where used',
        pattern: /\b(legitimate\s+use|legal\s+obligation|certain\s+legitimate\s+uses)\b/i,
      },
    ],
    recommendation:
      'Describe how consent is captured — an unticked checkbox or equivalent affirmative action — and confirm it is requested separately for each purpose rather than bundled into the terms of service.',
    suggestedLanguage:
      '"We process your personal data on the basis of your consent under Section 6 of the DPDPA, 2023. Consent is obtained through a clear affirmative action (an unticked checkbox presented alongside this Notice), is sought separately for each purpose, and is never a condition for accessing services that do not require that data."',
  },
  {
    id: 'consent_withdrawal',
    code: 'DPDPA-6.4',
    title: 'Withdrawal of Consent',
    category: 'consent',
    section: 'Section 6(4)–6(6)',
    weightClass: 'mandatory',
    summary:
      'A Data Principal may withdraw consent at any time, and withdrawing it must be as easy as giving it.',
    whyItMatters:
      'A policy that collects consent but hides or omits the exit route fails one of the most frequently enforced obligations in the Act.',
    anchors: [
      /\bwithdraw(al|ing)?\s+(your\s+|the\s+|of\s+)?consent\b/i,
      /\b(revoke|rescind|cancel)\s+(your\s+)?consent\b/i,
      /\bconsent\b[^.]{0,60}\b(withdraw|revoke)\b/i,
      /\bopt[- ]?out\b[^.]{0,60}\b(any\s+time|anytime|processing)\b/i,
    ],
    supporting: [/\bwithdraw\b/i, /\bopt[- ]?out\b/i, /\bunsubscribe\b/i, /\brevoke\b/i],
    specifics: [
      { label: 'Withdrawal available at any time', pattern: /\b(at\s+any\s+time|anytime)\b/i },
      {
        label: 'Explains how to withdraw',
        pattern:
          /\b(withdraw|opt[- ]?out|revoke)\b[^.]{0,120}\b(by|through|via|contact|email|settings|account|writing|link)\b/i,
      },
      {
        label: 'States the consequences of withdrawal',
        pattern:
          /\b(withdraw|withdrawal)\b[^.]{0,140}\b(cease|stop|discontinue|consequence|affect|no longer|delete)\b/i,
      },
      {
        label: 'Withdrawal as easy as giving consent',
        pattern: /\b(as\s+easy\s+as|same\s+ease|equally\s+easy)\b/i,
      },
    ],
    recommendation:
      'Give an explicit, always-available withdrawal route — a link, a settings toggle or a named email — and state plainly what happens to processing and to the data once consent is withdrawn.',
    suggestedLanguage:
      '"You may withdraw your consent at any time, with the same ease with which you gave it, from Account Settings → Privacy or by writing to privacy@[company].in. On withdrawal we will cease processing within [X] days and will erase the personal data unless retention is required by law. Withdrawal does not affect the lawfulness of processing carried out before it."',
  },
  {
    id: 'consent_manager',
    code: 'DPDPA-6.7',
    title: 'Consent Manager & Consent Records',
    category: 'consent',
    section: 'Section 6(7)–6(9)',
    weightClass: 'recommended',
    summary:
      'The Act contemplates registered Consent Managers, and requires the Data Fiduciary to be able to demonstrate that valid consent was obtained.',
    whyItMatters:
      'The burden of proving consent sits with the Data Fiduciary. Without a record or a Consent Manager route, that proof does not exist.',
    anchors: [
      /\bconsent\s+manager\b/i,
      /\b(record|log|maintain|evidence|proof)\s+of\s+consent\b/i,
      /\bconsent\s+(records?|logs?|history|receipts?|dashboard|preferences?\s+centre|preference\s+center)\b/i,
    ],
    supporting: [/\bconsent\s+management\b/i, /\bpreference\s+cent(re|er)\b/i, /\baudit\s+trail\b/i],
    specifics: [
      { label: 'References a Consent Manager', pattern: /\bconsent\s+manager\b/i },
      {
        label: 'Maintains consent records',
        pattern: /\b(record|log|maintain|retain)\b[^.]{0,50}\bconsent\b/i,
      },
    ],
    recommendation:
      'Describe how consent is recorded and how a Data Principal can review or manage it — through an in-product preference centre and, where used, a DPDPA-registered Consent Manager.',
    suggestedLanguage:
      '"We maintain an auditable record of every consent you give, including the notice version shown to you, the purpose, and the timestamp. You may review and change these at any time in your Privacy Dashboard, or through a Consent Manager registered with the Data Protection Board of India."',
  },
  {
    id: 'purpose_limitation',
    code: 'DPDPA-4.2',
    title: 'Purpose Specification & Limitation',
    category: 'data_handling',
    section: 'Section 4(2), 6(1)',
    weightClass: 'mandatory',
    summary:
      'Personal data may be processed only for the lawful purpose for which the Data Principal gave consent, or for a certain legitimate use.',
    whyItMatters:
      'Open-ended purposes such as "business purposes" cannot support valid consent, and quietly repurposing data is one of the clearest breaches of the Act.',
    anchors: [
      /\bfor\s+the\s+(specific\s+|following\s+|stated\s+)?purposes?\s+(of|described|set out|listed)/i,
      /\bpurpose\s+limitation\b/i,
      /\b(only|solely|exclusively)\s+(use|process|used|processed)\b[^.]{0,80}\bpurpose/i,
      /\b(we\s+)?(will|shall|do)\s+not\s+(use|process)\b[^.]{0,80}\b(other|unrelated|different)\s+purpose/i,
    ],
    supporting: [/\bpurpose\b/i, /\bin\s+order\s+to\b/i, /\blawful\s+purpose\b/i],
    specifics: [
      {
        label: 'Purposes are enumerated',
        pattern:
          /\b(purposes?)\b[^.]{0,60}\b(following|below|listed|include|such as|:)\b/i,
      },
      {
        label: 'Commits to no incompatible reuse',
        pattern:
          /\bnot\s+(use|process|share)\b[^.]{0,80}\b(other|unrelated|incompatible|new)\s+purpose/i,
      },
      {
        label: 'Fresh consent for new purposes',
        pattern: /\b(new|additional|further|separate)\s+(consent|purpose)\b/i,
      },
    ],
    recommendation:
      'Replace catch-all phrases such as "for business purposes" with an enumerated list mapping each data category to a specific purpose, and commit to obtaining fresh consent before any new purpose.',
    suggestedLanguage:
      '"We process your personal data only for the specific purposes listed in the table above. We will not use it for any other purpose without first giving you a fresh notice and obtaining your consent for that purpose."',
  },
  {
    id: 'data_minimisation',
    code: 'DPDPA-6.1-min',
    title: 'Data Minimisation',
    category: 'data_handling',
    section: 'Section 6(1)',
    weightClass: 'recommended',
    summary:
      'Consent is limited to such personal data as is necessary for the specified purpose — nothing beyond it may be collected.',
    whyItMatters:
      'Collecting "just in case" data expands breach exposure and cannot be justified against a specific purpose if the Board asks.',
    anchors: [
      /\bdata\s+minimi[sz]ation\b/i,
      /\b(only|solely)\s+(collect|process)\b[^.]{0,60}\b(necessary|required|needed|minimum)\b/i,
      /\b(necessary|minimum|limited)\s+(personal\s+)?(data|information)\b[^.]{0,60}\bpurpose\b/i,
      /\bno\s+more\s+(data|information)\s+than\b/i,
    ],
    supporting: [/\bnecessary\b/i, /\bminimum\b/i, /\bproportionate\b/i, /\bstrictly\s+required\b/i],
    specifics: [
      { label: 'Explicit minimisation commitment', pattern: /\bminimi[sz]ation|minimi[sz]e\b/i },
      {
        label: 'Collection tied to necessity',
        pattern: /\b(necessary|required|needed)\b[^.]{0,60}\b(purpose|service|provide)\b/i,
      },
    ],
    recommendation:
      'State that only data necessary for each stated purpose is collected, and mark optional fields as optional at the point of collection.',
    suggestedLanguage:
      '"We collect only the personal data that is necessary for the purpose you consented to. Fields that are optional are marked as such, and declining them will not prevent you from using the core service."',
  },
  {
    id: 'retention',
    code: 'DPDPA-8.7',
    title: 'Data Retention & Erasure',
    category: 'data_handling',
    section: 'Section 8(7)',
    weightClass: 'mandatory',
    summary:
      'Personal data must be erased once consent is withdrawn or the purpose is no longer being served, unless retention is required by law.',
    whyItMatters:
      'Indefinite retention is one of the most common findings in policy audits. Data held past its purpose is pure liability in a breach.',
    anchors: [
      /\b(retain|retention|store|keep)\b[^.]{0,100}\b(for\s+(a\s+)?(period|duration|as long as)|until|no longer than)\b/i,
      /\bretention\s+(period|policy|schedule|duration)\b/i,
      /\b(delete|eras|destroy|purge)\w*\b[^.]{0,90}\b(no longer (necessary|required|needed)|purpose (is|has been) (served|fulfilled)|withdraw)/i,
      /\bwe\s+(will|shall)\s+(delete|erase|destroy)\b/i,
    ],
    supporting: [/\bretain(ed|ing)?\b/i, /\bretention\b/i, /\bdelet(e|ion)\b/i, /\beras(e|ure)\b/i],
    specifics: [
      {
        label: 'States a definite retention period',
        pattern:
          /\b(\d+\s*(days?|months?|years?)|as (long|soon) as|until (you|the purpose)|thereafter)\b/i,
      },
      {
        label: 'Erasure on withdrawal / purpose completion',
        pattern:
          /\b(delete|eras|destroy|purge)\w*\b[^.]{0,100}\b(withdraw|no longer|purpose|account closure|terminat)/i,
      },
      {
        label: 'Names the legal retention exception',
        pattern: /\b(required|obliged|permitted)\s+(by|under)\s+(law|applicable law|statute)\b/i,
      },
      {
        label: 'Covers processors / backups',
        pattern: /\b(backup|archive|processor|third[- ]party)\b[^.]{0,80}\b(delete|eras|retain)/i,
      },
    ],
    recommendation:
      'Publish a retention schedule with a definite period per data category, and commit to erasure — including by processors and from backups — once consent is withdrawn or the purpose is served.',
    suggestedLanguage:
      '"We retain each category of personal data only for as long as the purpose it was collected for is being served: account data for the life of your account plus 90 days; transaction records for 8 years as required under applicable tax law. When you withdraw consent or close your account, we and our Data Processors erase the data within 30 days, including from backups on their next scheduled rotation."',
  },
  {
    id: 'data_sharing',
    code: 'DPDPA-8.2',
    title: 'Data Sharing & Disclosure',
    category: 'data_handling',
    section: 'Section 8(2)',
    weightClass: 'mandatory',
    summary:
      'A Data Fiduciary remains responsible for personal data shared with any Data Processor, and must disclose with whom data is shared and why.',
    whyItMatters:
      'Undisclosed onward sharing is a disclosure failure and, because the Fiduciary stays liable for its processors, a direct route to penalties.',
    anchors: [
      /\b(share|disclos|transfer|provide)\w*\b[^.]{0,90}\b(third[- ]part(y|ies)|service providers?|partners?|vendors?|processors?|affiliates?)\b/i,
      /\b(third[- ]part(y|ies)|service providers?)\b[^.]{0,80}\b(access|receive|process)\b/i,
      /\bwe\s+do\s+not\s+(sell|share|rent|trade)\b[^.]{0,50}\b(personal\s+)?(data|information)\b/i,
    ],
    supporting: [
      /\bthird\s+part(y|ies)\b/i,
      /\bservice\s+providers?\b/i,
      /\bsub[- ]?processors?\b/i,
      /\bdisclos(e|ure)\b/i,
    ],
    specifics: [
      {
        label: 'Identifies recipient categories',
        pattern:
          /\b(categor(y|ies)\s+of\s+recipients?|payment (processors?|gateways?)|cloud|analytics|hosting|logistics|courier)\b/i,
      },
      {
        label: 'Binds recipients contractually',
        pattern:
          /\b(contract|agreement|obligat\w+|bound|require)\b[^.]{0,90}\b(processor|third[- ]part|vendor|provider)\b/i,
      },
      {
        label: 'Addresses legal / regulatory disclosure',
        pattern: /\b(law\s+enforcement|court|legal\s+(process|obligation|request)|regulator)\b/i,
      },
      { label: 'States no sale of personal data', pattern: /\bnot\s+sell\b/i },
    ],
    recommendation:
      'List the categories of recipients and the purpose of each disclosure, and state that every Data Processor is bound by a written contract carrying the same obligations.',
    suggestedLanguage:
      '"We share personal data only with the categories of recipients listed below, and only for the purpose stated: payment gateways (to process payments), cloud hosting providers (to store data), and analytics providers (to measure usage). Every such recipient is engaged as a Data Processor under a written contract requiring it to process the data only on our instructions and to apply equivalent security safeguards. We do not sell your personal data."',
  },
];
