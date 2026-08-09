import { useState } from 'react';
import { AlertTriangle, ChevronDown } from 'lucide-react';
import { Badge, Card, CardHeader, SectionHeading } from '@/components/ui/primitives';
import { CATEGORIES } from '@/lib/dpdpa/categories';
import { REQUIREMENTS, WEIGHT_CLASS_LABEL } from '@/lib/dpdpa/requirements';
import { WEIGHT_META } from '@/components/ui/primitives';
import { cn } from '@/lib/utils';

const CONCEPTS = [
  {
    term: 'Data Principal',
    text: 'The individual to whom the personal data relates. Where the individual is a child, it includes the parent or lawful guardian.',
  },
  {
    term: 'Data Fiduciary',
    text: 'Any person who, alone or with others, determines the purpose and means of processing personal data. Carries the primary obligations under the Act.',
  },
  {
    term: 'Data Processor',
    text: 'A person who processes personal data on behalf of a Data Fiduciary, engaged only under a valid contract.',
  },
  {
    term: 'Consent',
    text: 'Must be free, specific, informed, unconditional and unambiguous, given by a clear affirmative action, and limited to the data necessary for the stated purpose.',
  },
  {
    term: 'Notice',
    text: 'Accompanies every request for consent. States the personal data sought, the purpose, how to withdraw consent, how to complain, and how to reach the Board.',
  },
  {
    term: 'Rights',
    text: 'Access to information (s.11), correction and erasure (s.12), grievance redressal (s.13) and nomination (s.14).',
  },
  {
    term: 'Duties',
    text: 'Section 15 binds the Data Principal too — no impersonation, no suppression of material information, no false or frivolous grievances.',
  },
  {
    term: 'Security Safeguards',
    text: 'Section 8(5) requires reasonable technical and organisational safeguards to prevent a personal data breach. An absolute duty, independent of whether a breach occurs.',
  },
  {
    term: 'Data Breach',
    text: 'Section 8(6) requires notification to the Data Protection Board of India and to every affected Data Principal, in the prescribed form and manner.',
  },
  {
    term: "Children's Data",
    text: 'Section 9 sets the age of a child at 18. Verifiable parental consent is mandatory; tracking, behavioural monitoring and targeted advertising to children are prohibited outright.',
  },
  {
    term: 'Grievance Redressal',
    text: 'Section 13 requires a readily available mechanism, which the Data Principal must exhaust before approaching the Board.',
  },
  {
    term: 'Significant Data Fiduciary',
    text: 'Notified by the Central Government based on volume and sensitivity of data. Must appoint an India-based DPO, engage an independent data auditor, and run periodic DPIAs and audits (s.10).',
  },
];

function RequirementRow({ id }: { id: string }) {
  const [open, setOpen] = useState(false);
  const req = REQUIREMENTS.find((r) => r.id === id)!;

  return (
    <div className="border-b border-hairline/50 last:border-0">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="flex w-full items-start justify-between gap-3 px-4 py-3 text-left transition-colors hover:bg-white/3 sm:px-5"
      >
        <div className="min-w-0">
          <p className="text-sm font-medium text-ink">{req.title}</p>
          <p className="mt-0.5 font-mono text-[0.6rem] uppercase tracking-[0.12em] text-ink-faint">
            {req.code} · {req.section}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <Badge tone={WEIGHT_META[req.weightClass].tone}>{WEIGHT_CLASS_LABEL[req.weightClass]}</Badge>
          <ChevronDown size={14} className={cn('text-ink-faint transition-transform', open && 'rotate-180')} />
        </div>
      </button>
      {open ? (
        <div className="space-y-2 px-4 pb-4 sm:px-5">
          <p className="text-xs leading-relaxed text-ink-dim">{req.summary}</p>
          <p className="text-xs leading-relaxed text-ink-faint">
            <span className="text-ink-dim">Why it matters: </span>
            {req.whyItMatters}
          </p>
        </div>
      ) : null}
    </div>
  );
}

export default function Framework() {
  return (
    <div className="space-y-6">
      <SectionHeading
        eyebrow="Reference"
        title="DPDPA Framework"
        description="The Digital Personal Data Protection Act, 2023 — and exactly which clause categories this scanner tests against."
      />

      <Card className="border-signal/30">
        <div className="flex items-start gap-3 p-4 sm:p-5">
          <AlertTriangle size={17} className="mt-0.5 shrink-0 text-signal" />
          <div>
            <p className="font-mono text-xs font-semibold uppercase tracking-[0.12em] text-signal">
              Scope of this assessment
            </p>
            <p className="mt-1.5 text-xs leading-relaxed text-ink-dim">
              DPDPA Sentinel performs an <span className="text-ink">automated policy assessment</span> using
              rule-based clause matching and keyword/NLP analysis. It reads only the document you upload and
              cannot verify what an organisation does in practice. The output is a preliminary assessment — it
              is <span className="text-ink">not a legal opinion</span> and does not replace review by a
              qualified legal professional. Ambiguous clauses are deliberately flagged rather than passed, so
              expect some over-flagging by design.
            </p>
          </div>
        </div>
      </Card>

      <Card>
        <CardHeader
          title="Overview of the DPDPA, 2023"
          subtitle="India's first comprehensive law governing the processing of digital personal data."
        />
        <div className="space-y-3 p-4 text-sm leading-relaxed text-ink-dim sm:p-5">
          <p>
            The Digital Personal Data Protection Act, 2023 governs how organisations collect, store, process
            and share the personal data of individuals in India. It applies to digital personal data processed
            within India, and to processing outside India where it relates to offering goods or services to
            Data Principals in India.
          </p>
          <p>
            The Act is built on consent: personal data may be processed only for a lawful purpose for which
            the Data Principal has given consent, or for a certain legitimate use. It grants individuals
            rights of access, correction, erasure, grievance redressal and nomination, and places duties of
            notice, purpose limitation, security, breach notification and retention discipline on Data
            Fiduciaries. Enforcement sits with the Data Protection Board of India, with financial penalties
            reaching ₹250 crore for a failure to take reasonable security safeguards.
          </p>
        </div>
      </Card>

      <Card>
        <CardHeader title="Key Concepts" subtitle="The vocabulary the scanner looks for in your policy." />
        <div className="grid gap-2 p-4 sm:grid-cols-2 sm:p-5">
          {CONCEPTS.map((c) => (
            <div key={c.term} className="rounded-lg border border-hairline bg-white/2 p-3">
              <p className="font-mono text-[0.68rem] font-semibold uppercase tracking-[0.1em] text-neon">
                {c.term}
              </p>
              <p className="mt-1.5 text-xs leading-relaxed text-ink-dim">{c.text}</p>
            </div>
          ))}
        </div>
      </Card>

      <Card>
        <CardHeader
          title="Scanner Rule Set"
          subtitle={`${REQUIREMENTS.length} clause categories, weighted mandatory = 3, conditional = 2, recommended = 1.`}
        />
        <div className="p-4 sm:p-5">
          <div className="space-y-4">
            {CATEGORIES.map((category) => {
              const ids = REQUIREMENTS.filter((r) => r.category === category.id).map((r) => r.id);
              if (ids.length === 0) return null;
              return (
                <div key={category.id} className="overflow-hidden rounded-lg border border-hairline">
                  <div className="border-b border-hairline bg-white/3 px-4 py-2.5 sm:px-5">
                    <p className="font-mono text-[0.7rem] font-semibold uppercase tracking-[0.14em] text-ink">
                      {category.label}
                    </p>
                    <p className="mt-0.5 text-[0.68rem] text-ink-faint">{category.blurb}</p>
                  </div>
                  {ids.map((id) => (
                    <RequirementRow key={id} id={id} />
                  ))}
                </div>
              );
            })}
          </div>
        </div>
      </Card>
    </div>
  );
}
