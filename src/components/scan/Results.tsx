import { useMemo, useState } from 'react';
import {
  Activity,
  Brain,
  ChevronDown,
  FileSearch,
  Lightbulb,
  ListChecks,
  ShieldAlert,
  Terminal,
} from 'lucide-react';
import {
  Badge,
  Button,
  Card,
  CardHeader,
  Progress,
  RISK_META,
  RiskBadge,
  StatusBadge,
  STATUS_META,
  WEIGHT_META,
} from '@/components/ui/primitives';
import { ScoreMeter } from '@/components/ScoreMeter';
import { RiskDonut } from '@/components/charts';
import type { ComplianceStatus, RequirementFinding, ScanResult } from '@/lib/dpdpa/types';
import { cn, formatNumber, truncate } from '@/lib/utils';

/* --------------------------- 1. Document analysis --------------------------- */

export function ExtractionPanel({ result }: { result: ScanResult }) {
  const [open, setOpen] = useState(false);
  const s = result.stats;

  const tiles = [
    { label: 'Pages', value: formatNumber(s.pages) },
    { label: 'Words', value: formatNumber(s.words) },
    { label: 'Sentences', value: formatNumber(s.sentences) },
    { label: 'Sections', value: formatNumber(s.sections) },
    { label: 'Extraction', value: `${Math.round(s.extractionRate * 100)}%` },
    { label: 'Processing', value: `${(result.durationMs / 1000).toFixed(1)}s` },
  ];

  return (
    <Card>
      <CardHeader
        title="Document Analysis"
        subtitle="What the extraction stage recovered from your file."
        icon={<FileSearch size={15} />}
        action={<Badge tone="cyan">{s.fileType.toUpperCase()}</Badge>}
      />
      <div className="grid grid-cols-2 gap-2 p-4 sm:grid-cols-3 sm:p-5 lg:grid-cols-6">
        {tiles.map((t) => (
          <div key={t.label} className="rounded-lg border border-hairline bg-white/2 px-3 py-2.5">
            <p className="label">{t.label}</p>
            <p className="mt-1 font-mono text-lg font-bold tabular-nums text-ink">{t.value}</p>
          </div>
        ))}
      </div>

      <div className="px-4 pb-4 sm:px-5 sm:pb-5">
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="flex w-full items-center justify-between rounded-lg border border-hairline bg-white/2 px-3 py-2 text-left transition-colors hover:border-neon/40"
          aria-expanded={open}
        >
          <span className="flex items-center gap-2">
            <Terminal size={14} className="text-neon" />
            <span className="font-mono text-[0.68rem] uppercase tracking-[0.14em] text-ink-dim">
              Extracted text ({formatNumber(s.characters)} chars)
            </span>
          </span>
          <ChevronDown size={15} className={cn('text-ink-faint transition-transform', open && 'rotate-180')} />
        </button>

        {open ? (
          <pre className="terminal mt-2 max-h-72 overflow-auto whitespace-pre-wrap rounded-lg p-3 text-ink-dim">
            {result.text}
          </pre>
        ) : null}
      </div>
    </Card>
  );
}

/* ------------------------------ 2. NLP analysis ----------------------------- */

export function NlpDashboard({ result }: { result: ScanResult }) {
  const mark = { yes: '✓', weak: '⚠', no: '✕' } as const;
  const tone = { yes: 'text-matrix', weak: 'text-signal', no: 'text-alert' } as const;

  return (
    <Card>
      <CardHeader
        title="NLP & Keyword Analysis"
        subtitle="Privacy concepts detected in the policy text, with occurrence counts and model confidence."
        icon={<Brain size={15} />}
        action={
          <Badge tone="cyan">
            {result.concepts.filter((c) => c.detected === 'yes').length}/{result.concepts.length} strong
          </Badge>
        }
      />
      <div className="grid gap-2 p-4 sm:grid-cols-2 sm:p-5 xl:grid-cols-3">
        {result.concepts.map((c) => (
          <div
            key={c.id}
            className="rounded-lg border border-hairline bg-white/2 p-3 transition-colors hover:border-neon/30"
            title={c.sampleSentence ? truncate(c.sampleSentence, 220) : c.description}
          >
            <div className="flex items-start justify-between gap-2">
              <p className="font-mono text-[0.68rem] font-semibold uppercase tracking-[0.1em] text-ink">
                {c.label}
              </p>
              <span className={cn('font-mono text-sm leading-none', tone[c.detected])}>
                {mark[c.detected]}
              </span>
            </div>
            <div className="mt-2 flex items-center gap-2">
              <Progress
                value={c.confidence * 100}
                className="h-1"
                tone={c.detected === 'yes' ? 'green' : c.detected === 'weak' ? 'amber' : 'red'}
              />
              <span className="shrink-0 font-mono text-[0.62rem] tabular-nums text-ink-dim">
                {Math.round(c.confidence * 100)}%
              </span>
            </div>
            <p className="mt-1.5 font-mono text-[0.6rem] uppercase tracking-[0.12em] text-ink-faint">
              {c.frequency} occurrence{c.frequency === 1 ? '' : 's'}
            </p>
          </div>
        ))}
      </div>
    </Card>
  );
}

/* --------------------------- 3. Compliance matrix --------------------------- */

const FILTERS: { id: ComplianceStatus | 'all'; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'compliant', label: 'Compliant' },
  { id: 'partial', label: 'Partial' },
  { id: 'non_compliant', label: 'Non-Compliant' },
  { id: 'not_detected', label: 'Not Detected' },
];

function EvidenceList({ finding }: { finding: RequirementFinding }) {
  if (!finding.evidence.length) {
    return <p className="text-xs italic text-ink-faint">No matching text found in the document.</p>;
  }
  return (
    <ul className="space-y-1.5">
      {finding.evidence.map((e) => (
        <li key={e.index} className="rounded border border-hairline bg-black/30 p-2">
          <p className="font-mono text-[0.68rem] leading-relaxed text-ink-dim">“{truncate(e.sentence, 300)}”</p>
          <div className="mt-1.5 flex flex-wrap gap-1.5">
            <Badge tone="neutral">match {(e.score * 100).toFixed(0)}%</Badge>
            {e.negated ? <Badge tone="red">negated</Badge> : null}
            {e.hedged ? <Badge tone="amber">hedged</Badge> : null}
          </div>
        </li>
      ))}
    </ul>
  );
}

export function ComplianceMatrix({ result }: { result: ScanResult }) {
  const [filter, setFilter] = useState<ComplianceStatus | 'all'>('all');
  const [expanded, setExpanded] = useState<string | null>(null);

  const rows = useMemo(
    () => (filter === 'all' ? result.findings : result.findings.filter((f) => f.status === filter)),
    [result.findings, filter],
  );

  return (
    <Card>
      <CardHeader
        title="DPDPA Compliance Matrix"
        subtitle={`${result.findings.length} clause categories tested. Click any row to see the matched source text.`}
        icon={<ListChecks size={15} />}
      />

      <div className="flex flex-wrap gap-1.5 border-b border-hairline/70 px-4 py-3 sm:px-5">
        {FILTERS.map((f) => {
          const count =
            f.id === 'all'
              ? result.findings.length
              : result.findings.filter((r) => r.status === f.id).length;
          return (
            <button
              key={f.id}
              type="button"
              onClick={() => setFilter(f.id)}
              className={cn(
                'rounded-md border px-2.5 py-1 font-mono text-[0.62rem] font-semibold uppercase tracking-[0.1em] transition-colors',
                filter === f.id
                  ? 'border-neon/60 bg-neon/12 text-neon'
                  : 'border-hairline text-ink-faint hover:border-neon/35 hover:text-ink-dim',
              )}
            >
              {f.label} · {count}
            </button>
          );
        })}
      </div>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[880px] border-collapse text-left">
          <thead>
            <tr className="border-b border-hairline/70">
              {['Requirement', 'Detected', 'Status', 'Risk', 'Recommendation'].map((h) => (
                <th key={h} className="label px-4 py-2.5 font-medium">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((f) => {
              const isOpen = expanded === f.requirement.id;
              return (
                <>
                  <tr
                    key={f.requirement.id}
                    onClick={() => setExpanded(isOpen ? null : f.requirement.id)}
                    className={cn(
                      'cursor-pointer border-b border-hairline/50 align-top transition-colors',
                      isOpen ? 'bg-neon/6' : 'hover:bg-white/3',
                    )}
                  >
                    <td className="px-4 py-3">
                      <p className="text-sm font-medium text-ink">{f.requirement.title}</p>
                      <p className="mt-0.5 font-mono text-[0.6rem] uppercase tracking-[0.12em] text-ink-faint">
                        {f.requirement.code} · {f.requirement.section}
                      </p>
                      <Badge tone={WEIGHT_META[f.requirement.weightClass].tone} className="mt-1.5">
                        {WEIGHT_META[f.requirement.weightClass].label}
                      </Badge>
                    </td>
                    <td className="px-4 py-3">
                      <p className="font-mono text-sm tabular-nums text-ink">
                        {Math.round(f.confidence * 100)}%
                      </p>
                      <p className="mt-0.5 font-mono text-[0.6rem] uppercase tracking-[0.1em] text-ink-faint">
                        {f.evidence.length} match{f.evidence.length === 1 ? '' : 'es'}
                      </p>
                    </td>
                    <td className="px-4 py-3">
                      <StatusBadge status={f.status} />
                    </td>
                    <td className="px-4 py-3">
                      <RiskBadge level={f.risk} />
                    </td>
                    <td className="max-w-sm px-4 py-3">
                      <p className="text-xs leading-relaxed text-ink-dim">
                        {f.status === 'compliant' ? 'No action required.' : truncate(f.requirement.recommendation, 130)}
                      </p>
                      <span className="mt-1 inline-flex items-center gap-1 font-mono text-[0.6rem] uppercase tracking-[0.12em] text-neon">
                        {isOpen ? 'Hide details' : 'View details'}
                        <ChevronDown size={11} className={cn('transition-transform', isOpen && 'rotate-180')} />
                      </span>
                    </td>
                  </tr>

                  {isOpen ? (
                    <tr key={`${f.requirement.id}-detail`} className="border-b border-hairline/50 bg-black/25">
                      <td colSpan={5} className="px-4 py-4">
                        <div className="grid gap-4 lg:grid-cols-2">
                          <div className="space-y-3">
                            <div>
                              <p className="label mb-1">Requirement</p>
                              <p className="text-xs leading-relaxed text-ink-dim">{f.requirement.summary}</p>
                            </div>
                            <div>
                              <p className="label mb-1">Detected issue</p>
                              <p className="text-xs leading-relaxed text-ink-dim">{f.issue}</p>
                            </div>
                            <div>
                              <p className="label mb-1">Why it matters</p>
                              <p className="text-xs leading-relaxed text-ink-dim">{f.requirement.whyItMatters}</p>
                            </div>
                            {f.matchedSpecifics.length || f.missingSpecifics.length ? (
                              <div>
                                <p className="label mb-1.5">Clause elements</p>
                                <div className="flex flex-wrap gap-1.5">
                                  {f.matchedSpecifics.map((m) => (
                                    <Badge key={m} tone="green">
                                      ✓ {m}
                                    </Badge>
                                  ))}
                                  {f.missingSpecifics.map((m) => (
                                    <Badge key={m} tone="red">
                                      ✕ {m}
                                    </Badge>
                                  ))}
                                </div>
                              </div>
                            ) : null}
                          </div>

                          <div className="space-y-3">
                            <div>
                              <p className="label mb-1.5">Matched source text</p>
                              <EvidenceList finding={f} />
                            </div>
                            {f.status !== 'compliant' ? (
                              <div>
                                <p className="label mb-1">Suggested policy language</p>
                                <p className="rounded border border-neon/25 bg-neon/5 p-2 font-mono text-[0.66rem] leading-relaxed text-ink-dim">
                                  {f.requirement.suggestedLanguage}
                                </p>
                              </div>
                            ) : null}
                          </div>
                        </div>
                      </td>
                    </tr>
                  ) : null}
                </>
              );
            })}
          </tbody>
        </table>
      </div>
    </Card>
  );
}

/* ------------------------------- 4. Score card ------------------------------ */

export function ScoreCard({ result }: { result: ScanResult }) {
  const t = result.totals;

  const legend = [
    { label: 'Compliant', value: t.compliant, tone: 'green' as const },
    { label: 'Partial', value: t.partial, tone: 'amber' as const },
    { label: 'Non-Compliant', value: t.nonCompliant, tone: 'red' as const },
    { label: 'Not Detected', value: t.notDetected, tone: 'neutral' as const },
  ];

  return (
    <Card>
      <CardHeader
        title="Compliance Score"
        subtitle="Weighted across all applicable DPDPA clause categories."
        icon={<Activity size={15} />}
      />
      <div className="grid gap-5 p-4 sm:p-5 lg:grid-cols-[auto_minmax(0,1fr)]">
        <div className="mx-auto lg:mx-0">
          <ScoreMeter score={result.score} verdict={result.verdict} riskLevel={result.riskLevel} />
        </div>

        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {legend.map((l) => (
              <div key={l.label} className="rounded-lg border border-hairline bg-white/2 px-3 py-2">
                <p className="label">{l.label}</p>
                <p className="mt-1 font-mono text-xl font-bold tabular-nums text-ink">{l.value}</p>
              </div>
            ))}
          </div>

          <div className="rounded-lg border border-hairline bg-black/25 px-3 py-2.5">
            <p className="label mb-1">Scoring formula</p>
            <p className="font-mono text-[0.68rem] text-ink-dim">
              Score = (Σ weight<sub>matched</sub> / Σ weight<sub>applicable</sub>) × 100 = (
              <span className="text-neon">{t.earnedWeight.toFixed(1)}</span> /{' '}
              <span className="text-neon">{t.applicableWeight.toFixed(1)}</span>) × 100 ={' '}
              <span className="font-bold text-neon">{result.score}</span>
            </p>
            <p className="mt-1.5 text-[0.64rem] leading-relaxed text-ink-faint">
              Mandatory = 3 · Conditional = 2 · Recommended = 1. Partial matches earn half weight.{' '}
              {t.notApplicable} conditional requirement{t.notApplicable === 1 ? '' : 's'} not triggered by this
              document and excluded from the denominator.
            </p>
          </div>

          <div>
            <p className="label mb-2">Category scores</p>
            <div className="space-y-2">
              {result.categories.map((c) => (
                <div key={c.id}>
                  <div className="mb-1 flex items-center justify-between gap-2">
                    <span className="truncate text-xs text-ink-dim">{c.label}</span>
                    <span className="shrink-0 font-mono text-xs tabular-nums text-ink">{c.score}%</span>
                  </div>
                  <Progress
                    value={c.score}
                    className="h-1.5"
                    tone={c.score >= 80 ? 'green' : c.score >= 55 ? 'cyan' : c.score >= 35 ? 'amber' : 'red'}
                  />
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </Card>
  );
}

/* ------------------------------ 5. Risk analysis ---------------------------- */

export function RiskPanel({ result }: { result: ScanResult }) {
  const groups = (['critical', 'high', 'medium', 'low'] as const).map((level) => ({
    level,
    items: result.risks.filter((r) => r.level === level),
  }));

  return (
    <Card>
      <CardHeader
        title="Cyber Risk Assessment"
        subtitle={`${result.risks.length} finding${result.risks.length === 1 ? '' : 's'} ranked by severity.`}
        icon={<ShieldAlert size={15} />}
        action={<RiskBadge level={result.riskLevel} />}
      />
      <div className="grid gap-5 p-4 sm:p-5 lg:grid-cols-[minmax(0,1fr)_auto]">
        <div className="space-y-4">
          {groups.every((g) => g.items.length === 0) ? (
            <p className="text-sm text-matrix">
              No risks identified — every applicable requirement was satisfied.
            </p>
          ) : (
            groups
              .filter((g) => g.items.length > 0)
              .map((g) => (
                <div key={g.level}>
                  <div className="mb-2 flex items-center gap-2">
                    <span
                      className="h-2 w-2 rounded-full"
                      style={{ background: RISK_META[g.level].color }}
                      aria-hidden
                    />
                    <p className="font-mono text-[0.68rem] font-bold uppercase tracking-[0.16em] text-ink">
                      {RISK_META[g.level].label} · {g.items.length}
                    </p>
                  </div>
                  <ul className="space-y-1.5">
                    {g.items.map((r) => (
                      <li
                        key={r.requirementId}
                        className="rounded-lg border border-hairline bg-white/2 px-3 py-2"
                        style={{ borderLeftColor: RISK_META[g.level].color, borderLeftWidth: 2 }}
                      >
                        <p className="text-xs font-medium text-ink">{r.title}</p>
                        <p className="mt-0.5 text-[0.68rem] leading-relaxed text-ink-faint">{r.detail}</p>
                      </li>
                    ))}
                  </ul>
                </div>
              ))
          )}
        </div>

        <div className="mx-auto w-full max-w-xs lg:w-64">
          <p className="label mb-2 text-center">Risk distribution</p>
          <RiskDonut risks={result.risks} />
        </div>
      </div>
    </Card>
  );
}

/* ---------------------------- 6. Recommendations ---------------------------- */

export function Recommendations({ result }: { result: ScanResult }) {
  const [open, setOpen] = useState<string | null>(null);
  const gaps = result.findings.filter(
    (f) => f.status !== 'compliant' && f.status !== 'not_applicable',
  );

  return (
    <Card>
      <CardHeader
        title="Compliance Recommendations"
        subtitle={`Remediation guidance for ${gaps.length} requirement${gaps.length === 1 ? '' : 's'} that did not fully pass.`}
        icon={<Lightbulb size={15} />}
      />
      <div className="grid gap-2 p-4 sm:p-5 lg:grid-cols-2">
        {gaps.length === 0 ? (
          <p className="text-sm text-matrix">
            Nothing to remediate — the policy satisfied every applicable requirement.
          </p>
        ) : (
          gaps.map((f) => {
            const isOpen = open === f.requirement.id;
            return (
              <div
                key={f.requirement.id}
                className="rounded-lg border border-hairline bg-white/2 p-3 transition-colors hover:border-neon/30"
              >
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="font-mono text-[0.7rem] font-semibold uppercase tracking-[0.1em] text-ink">
                      {f.requirement.title}
                    </p>
                    <p className="mt-0.5 font-mono text-[0.58rem] uppercase tracking-[0.12em] text-ink-faint">
                      {f.requirement.code}
                    </p>
                  </div>
                  <div className="flex shrink-0 gap-1.5">
                    <StatusBadge status={f.status} />
                    <RiskBadge level={f.risk} />
                  </div>
                </div>

                <p className="mt-2 text-xs leading-relaxed text-ink-dim">
                  <span className="text-ink-faint">Issue: </span>
                  {f.issue}
                </p>
                <p className="mt-1.5 text-xs leading-relaxed text-ink-dim">
                  <span className="text-ink-faint">Action: </span>
                  {f.requirement.recommendation}
                </p>

                {isOpen ? (
                  <div className="mt-2.5 space-y-2 border-t border-hairline pt-2.5">
                    <div>
                      <p className="label mb-1">Why it matters</p>
                      <p className="text-xs leading-relaxed text-ink-dim">{f.requirement.whyItMatters}</p>
                    </div>
                    <div>
                      <p className="label mb-1">Suggested policy language</p>
                      <p className="rounded border border-neon/25 bg-neon/5 p-2 font-mono text-[0.66rem] leading-relaxed text-ink-dim">
                        {f.requirement.suggestedLanguage}
                      </p>
                    </div>
                  </div>
                ) : null}

                <Button
                  variant="ghost"
                  size="sm"
                  className="mt-2 px-0"
                  onClick={() => setOpen(isOpen ? null : f.requirement.id)}
                >
                  {isOpen ? 'Hide details' : 'View details'}
                  <ChevronDown size={12} className={cn('transition-transform', isOpen && 'rotate-180')} />
                </Button>
              </div>
            );
          })
        )}
      </div>
    </Card>
  );
}

export { STATUS_META };
