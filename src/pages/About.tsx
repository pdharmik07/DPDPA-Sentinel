import { Card, CardHeader, SectionHeading } from '@/components/ui/primitives';
import { REQUIREMENT_COUNT } from '@/lib/dpdpa/requirements';
import { CONCEPTS } from '@/lib/dpdpa/concepts';

const TEAM = [
  { name: 'Patel Dharmikkumar P.', roll: '2301030700036' },
  { name: 'Chauhan Priyanshusinh J.', roll: '2301030700011' },
  { name: 'Tarpara Moksha S.', roll: '2301030700101' },
];

const PIPELINE = [
  ['01 Document Ingestion', 'Validates format, size and integrity before anything is read.'],
  ['02 Text Extraction', 'PDF.js recovers text and page structure; Mammoth handles DOCX; TXT is read directly.'],
  ['03 Preprocessing', 'Whitespace normalisation, abbreviation-aware sentence segmentation, heading detection.'],
  ['04 NLP Analysis', `Matches ${CONCEPTS.length} privacy concepts and flags negation and hedging cues.`],
  ['05 DPDPA Rule Mapping', `Scores each sentence against ${REQUIREMENT_COUNT} clause categories and captures source evidence.`],
  ['06 Compliance Scoring', 'Applies the weighted formula across applicable clauses only.'],
  ['07 Report Generation', 'Assembles findings, risk ranking, remediation text and exports.'],
];

export default function About() {
  return (
    <div className="space-y-6">
      <SectionHeading
        eyebrow="Project"
        title="About DPDPA Sentinel"
        description="A minor project built for the Department of Computer Engineering, Silver Oak University."
      />

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
        <Card>
          <CardHeader title="What it does" />
          <div className="space-y-3 p-4 text-sm leading-relaxed text-ink-dim sm:p-5">
            <p>
              Many startups and companies do not know whether their privacy policy meets the Digital Personal
              Data Protection Act, 2023. Checking it manually needs legal expertise and takes time.
            </p>
            <p>
              DPDPA Sentinel reads an uploaded privacy policy, extracts its text, identifies the privacy
              clauses it contains, compares them against a {REQUIREMENT_COUNT}-category DPDPA rule ontology, and
              produces a weighted compliance score with source-linked findings and remediation guidance.
            </p>
            <p>
              Every part runs in the browser — the uploaded file never leaves the device, and no server or
              database is involved.
            </p>
          </div>
        </Card>

        <Card>
          <CardHeader title="Project Details" />
          <dl className="divide-y divide-hairline/50">
            {[
              ['Project ID', 'CSE_CS_32'],
              ['Type', 'Minor Project'],
              ['Branch', 'B.Tech, CSE — Cyber Security'],
              ['Guide', 'Mr. Sunny Mesuriya'],
              ['Institution', 'Silver Oak University'],
            ].map(([k, v]) => (
              <div key={k} className="flex items-center justify-between gap-3 px-4 py-2.5 sm:px-5">
                <dt className="label">{k}</dt>
                <dd className="text-right text-xs text-ink">{v}</dd>
              </div>
            ))}
          </dl>
          <div className="border-t border-hairline/50 px-4 py-3 sm:px-5">
            <p className="label mb-2">Team</p>
            <ul className="space-y-1.5">
              {TEAM.map((m) => (
                <li key={m.roll} className="flex items-center justify-between gap-3">
                  <span className="text-xs text-ink">{m.name}</span>
                  <span className="font-mono text-[0.62rem] text-ink-faint">{m.roll}</span>
                </li>
              ))}
            </ul>
          </div>
        </Card>
      </div>

      <Card>
        <CardHeader title="How the analysis works" subtitle="Seven stages, all client-side." />
        <div className="grid gap-2 p-4 sm:grid-cols-2 sm:p-5">
          {PIPELINE.map(([title, text]) => (
            <div key={title} className="rounded-lg border border-hairline bg-white/2 p-3">
              <p className="font-mono text-[0.68rem] font-semibold uppercase tracking-[0.1em] text-neon">
                {title}
              </p>
              <p className="mt-1.5 text-xs leading-relaxed text-ink-dim">{text}</p>
            </div>
          ))}
        </div>
      </Card>

      <Card>
        <CardHeader title="Scoring methodology" />
        <div className="space-y-3 p-4 sm:p-5">
          <p className="rounded-lg border border-neon/25 bg-neon/5 p-3 text-center font-mono text-sm text-neon">
            Score = (Σ weight[matched] / Σ weight[applicable]) × 100
          </p>
          <ul className="space-y-1.5 text-xs leading-relaxed text-ink-dim">
            <li>
              <span className="text-ink">Mandatory clauses</span> (consent, breach notification, security
              safeguards) carry weight 3.
            </li>
            <li>
              <span className="text-ink">Conditional clauses</span> (children&apos;s data, cross-border
              transfer, Significant Data Fiduciary duties) carry weight 2, and are excluded from the
              denominator entirely when nothing in the document triggers them.
            </li>
            <li>
              <span className="text-ink">Recommended clauses</span> (best practice) carry weight 1.
            </li>
            <li>
              A fully satisfied clause earns full weight, a partial match earns half, and a missing or
              contradicted clause earns none.
            </li>
            <li>
              <span className="text-ink">Conservative bias:</span> negation cues (&ldquo;we do not
              provide&rdquo;) and hedging (&ldquo;we may&rdquo;, &ldquo;where feasible&rdquo;) reduce
              confidence, so ambiguous clauses are flagged rather than passed.
            </li>
            <li>
              <span className="text-ink">Human in the loop:</span> every finding shows the matched source
              sentences so a reviewer can verify it.
            </li>
          </ul>
        </div>
      </Card>

      <Card>
        <CardHeader title="Technology" />
        <div className="flex flex-wrap gap-2 p-4 sm:p-5">
          {[
            'React 18',
            'TypeScript',
            'Vite',
            'Tailwind CSS v4',
            'Framer Motion',
            'Recharts',
            'Lucide Icons',
            'PDF.js',
            'Mammoth.js',
            'jsPDF',
          ].map((t) => (
            <span
              key={t}
              className="rounded-md border border-hairline bg-white/3 px-2.5 py-1 font-mono text-[0.64rem] uppercase tracking-[0.1em] text-ink-dim"
            >
              {t}
            </span>
          ))}
        </div>
      </Card>
    </div>
  );
}
