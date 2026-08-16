import { Card, CardHeader, SectionHeading } from '@/components/ui/primitives';
import { CONCEPTS } from '@/lib/dpdpa/concepts';
import { useRuleSetSummary } from '@/lib/api/useRuleSetSummary';

const TEAM = [
  { name: 'Patel Dharmikkumar P.', roll: '2301030700036' },
  { name: 'Chauhan Priyanshusinh J.', roll: '2301030700011' },
  { name: 'Tarpara Moksha S.', roll: '2301030700101' },
];

const PROJECT = [
  ['Project ID', 'CSE_CS_32'],
  ['Type', 'Minor Project'],
  ['Branch', 'B.Tech, CSE — Cyber Security'],
  ['Guide', 'Mr. Sunny Mesuriya'],
  ['Institution', 'Silver Oak University'],
];

const TECHNOLOGY = [
  'React 18',
  'TypeScript',
  'Vite',
  'Tailwind CSS v4',
  'Framer Motion',
  'Recharts',
  'Node.js',
  'Express',
  'PostgreSQL',
  'Prisma',
  'Argon2id',
  'JWT',
  'Python',
  'FastAPI',
  'spaCy',
  'sentence-transformers',
  'PDFKit',
];

/** Stage copy depends on the live rule count, so it is built per render. */
function pipelineStages(ruleCount: string): [string, string][] {
  return [
    ['01 Document Ingestion', 'Validates extension, size and MIME on the client, then re-validates on the server by magic bytes.'],
    ['02 Text Extraction', 'Runs on the server: PDF.js recovers text and page structure, Mammoth handles DOCX, TXT and MD are read directly.'],
    ['03 Preprocessing', 'Whitespace normalisation, abbreviation-aware sentence segmentation, paragraph and heading detection.'],
    ['04 NLP Analysis', `Optional semantic layer scores similarity against rule concepts and detects negation. Advisory only — it never decides an outcome. The browser also matches ${CONCEPTS.length} privacy concepts for the concept panel.`],
    ['05 DPDPA Rule Mapping', `A deterministic engine evaluates ${ruleCount} rules, first deciding whether each applies, then capturing the source sentences that justify the decision.`],
    ['06 Compliance Scoring', 'Applies the design-document point model across applicable rules only, then assesses risk from the pattern of failures.'],
    ['07 Report Generation', 'Assembles findings, risk factors and prioritised remediation into PDF and JSON reports.'],
  ];
}

export default function About() {
  const ruleSet = useRuleSetSummary();
  const ruleCount = ruleSet ? String(ruleSet.ruleCount) : 'the configured';
  const categoryCount = ruleSet ? String(ruleSet.categoryCount) : 'multiple';

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
              clauses it contains, evaluates them against {ruleCount} rules across {categoryCount} categories
              derived from the DPDP Act 2023 and the DPDP Rules 2025, and produces a weighted score with
              source-linked findings, a risk assessment and remediation guidance.
            </p>
            <p>
              Uploaded documents are sent to the DPDPA Sentinel backend over HTTPS, analysed there, and stored
              against your account so you can reopen a report later. Scans are private to your account and you
              can delete any of them at any time from Reports or Settings.
            </p>
            <p className="text-ink-faint">
              This tool produces an automated preliminary assessment. It is not a legal opinion, certification
              or a substitute for review by a qualified legal or privacy professional.
            </p>
          </div>
        </Card>

        <Card>
          <CardHeader title="Project Details" />
          <dl className="divide-y divide-hairline/50">
            {PROJECT.map(([k, v]) => (
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
        <CardHeader
          title="How the analysis works"
          subtitle={
            ruleSet
              ? `Seven stages · rule pack v${ruleSet.ruleVersion}`
              : 'Seven stages'
          }
        />
        <div className="grid gap-2 p-4 sm:grid-cols-2 sm:p-5">
          {pipelineStages(ruleCount).map(([title, text]) => (
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
        <CardHeader title="Scoring methodology" subtitle="From the project's Rule Engine Design Document" />
        <div className="space-y-3 p-4 sm:p-5">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[26rem] text-xs">
              <thead>
                <tr className="border-b border-hairline/60 text-left">
                  <th className="label py-2">Weight class</th>
                  <th className="label py-2 text-center">Pass</th>
                  <th className="label py-2 text-center">Partial</th>
                  <th className="label py-2 text-center">Fail</th>
                  <th className="label py-2 text-center">N/A</th>
                </tr>
              </thead>
              <tbody className="text-ink-dim">
                {[
                  ['Mandatory', '3', '1', '0', '—'],
                  ['Conditional', '2', '1', '0', 'excluded'],
                  ['Recommended', '1', '0.5', '0', '—'],
                ].map(([cls, ...cells]) => (
                  <tr key={cls} className="border-b border-hairline/40 last:border-b-0">
                    <td className="py-2 text-ink">{cls}</td>
                    {cells.map((c, i) => (
                      <td key={i} className="py-2 text-center font-mono tabular-nums">
                        {c}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <p className="rounded-lg border border-neon/25 bg-neon/5 p-3 text-center font-mono text-[0.7rem] leading-relaxed text-neon">
            category = (points earned / max points for applicable rules) × 100
            <br />
            overall = weighted average of category scores
          </p>

          <ul className="space-y-1.5 text-xs leading-relaxed text-ink-dim">
            <li>
              <span className="text-ink">Applicability first:</span> a conditional obligation nothing in the
              document triggers — cross-border transfer, children&apos;s data, Significant Data Fiduciary
              duties — is excluded from both numerator and denominator rather than scored as a failure.
            </li>
            <li>
              <span className="text-ink">Conservative bias:</span> negation cues (&ldquo;we do not
              provide&rdquo;) and hedging (&ldquo;we may&rdquo;, &ldquo;where feasible&rdquo;) reduce
              confidence, so ambiguous clauses are flagged rather than passed. A policy that both asserts and
              denies the same obligation is capped at partial.
            </li>
            <li>
              <span className="text-ink">Rules decide, not the language model:</span> semantic similarity can
              raise confidence but can never on its own produce a pass — that additionally requires a
              non-negated anchor match and the specific sub-elements the obligation calls for.
            </li>
            <li>
              <span className="text-ink">Human in the loop:</span> every finding shows the matched source
              sentences and its legal reference so a reviewer can verify it.
            </li>
          </ul>
        </div>
      </Card>

      <Card>
        <CardHeader title="Technology" />
        <div className="flex flex-wrap gap-2 p-4 sm:p-5">
          {TECHNOLOGY.map((t) => (
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
