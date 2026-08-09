import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Download, FileDown, Printer, Radar, Search, Trash2 } from 'lucide-react';
import {
  Badge,
  Button,
  Card,
  CardHeader,
  EmptyState,
  Progress,
  RiskBadge,
  SectionHeading,
  StatusBadge,
} from '@/components/ui/primitives';
import { ScoreMeter } from '@/components/ScoreMeter';
import { downloadReportJson, downloadReportPdf } from '@/lib/reportExport';
import { formatBytes, formatDate, formatNumber } from '@/lib/utils';
import type { RiskLevel } from '@/lib/dpdpa/types';
import { useApp } from '@/store/AppContext';

/* -------------------------------- Report view ------------------------------- */

function ReportViewer() {
  const { result } = useApp();
  if (!result) return null;

  const t = result.totals;
  const criticals = result.risks.filter((r) => r.level === 'critical');

  return (
    <Card className="print-plain overflow-hidden">
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-hairline/70 px-4 py-4 sm:px-6">
        <div>
          <h2 className="font-mono text-base font-bold uppercase tracking-[0.16em] text-ink">
            DPDPA Compliance Report
          </h2>
          <p className="mt-1 font-mono text-[0.62rem] uppercase tracking-[0.14em] text-ink-faint">
            Report ID {result.id} · Generated {formatDate(result.createdAt)}
          </p>
        </div>
        <div className="no-print flex flex-wrap gap-2">
          <Button variant="solid" size="sm" onClick={() => downloadReportPdf(result)}>
            <FileDown size={13} /> Download PDF
          </Button>
          <Button variant="outline" size="sm" onClick={() => downloadReportJson(result)}>
            <Download size={13} /> Export JSON
          </Button>
          <Button variant="outline" size="sm" onClick={() => window.print()}>
            <Printer size={13} /> Print
          </Button>
        </div>
      </div>

      <div className="space-y-6 p-4 sm:p-6">
        {/* Document information */}
        <section className="print-break">
          <p className="label mb-2">Document Information</p>
          <dl className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
            {[
              ['File name', result.stats.fileName],
              ['Document size', formatBytes(result.stats.fileSize)],
              ['Pages', formatNumber(result.stats.pages)],
              ['Words', formatNumber(result.stats.words)],
              ['Duration', `${(result.durationMs / 1000).toFixed(1)}s`],
            ].map(([k, v]) => (
              <div key={k} className="min-w-0 rounded-lg border border-hairline bg-white/2 px-3 py-2">
                <dt className="label">{k}</dt>
                <dd className="mt-1 truncate font-mono text-xs text-ink" title={v}>
                  {v}
                </dd>
              </div>
            ))}
          </dl>
        </section>

        {/* Summary + score */}
        <section className="print-break grid gap-5 lg:grid-cols-[auto_minmax(0,1fr)]">
          <div className="mx-auto lg:mx-0">
            <ScoreMeter
              score={result.score}
              verdict={result.verdict}
              riskLevel={result.riskLevel}
              size={172}
              animate={false}
            />
          </div>
          <div>
            <p className="label mb-2">Executive Summary</p>
            <p className="text-sm leading-relaxed text-ink-dim">
              The uploaded policy scored <span className="font-mono font-bold text-ink">{result.score}/100</span>{' '}
              against the Digital Personal Data Protection Act, 2023 and is assessed as{' '}
              <span className="font-semibold text-ink">{result.verdict}</span>. Of {t.checked} applicable clause
              categories, {t.compliant} were satisfied, {t.partial} partially satisfied, {t.nonCompliant}{' '}
              inadequate and {t.notDetected} not found. Residual risk is{' '}
              <span className="uppercase text-ink">{result.riskLevel}</span>.
            </p>

            <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
              {[
                ['Checked', t.checked],
                ['Compliant', t.compliant],
                ['Partial', t.partial],
                ['Missing', t.notDetected + t.nonCompliant],
              ].map(([k, v]) => (
                <div key={k} className="rounded-lg border border-hairline bg-white/2 px-3 py-2">
                  <p className="label">{k}</p>
                  <p className="mt-1 font-mono text-lg font-bold tabular-nums text-ink">{v}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Category scores */}
        <section className="print-break">
          <p className="label mb-2">Category-wise Scores</p>
          <div className="grid gap-2.5 sm:grid-cols-2">
            {result.categories.map((c) => (
              <div key={c.id}>
                <div className="mb-1 flex items-center justify-between gap-2">
                  <span className="truncate text-xs text-ink-dim">{c.label}</span>
                  <span className="font-mono text-xs tabular-nums text-ink">{c.score}%</span>
                </div>
                <Progress
                  value={c.score}
                  className="h-1.5"
                  tone={c.score >= 80 ? 'green' : c.score >= 55 ? 'cyan' : c.score >= 35 ? 'amber' : 'red'}
                />
              </div>
            ))}
          </div>
        </section>

        {/* Critical findings */}
        {criticals.length > 0 ? (
          <section className="print-break">
            <p className="label mb-2">Critical Findings</p>
            <ul className="space-y-1.5">
              {criticals.map((r) => (
                <li
                  key={r.requirementId}
                  className="rounded-lg border border-alert/30 bg-alert/6 px-3 py-2"
                >
                  <p className="text-xs font-semibold text-ink">{r.title}</p>
                  <p className="mt-0.5 text-[0.7rem] leading-relaxed text-ink-dim">{r.detail}</p>
                </li>
              ))}
            </ul>
          </section>
        ) : null}

        {/* Matrix */}
        <section className="print-break">
          <p className="label mb-2">DPDPA Compliance Matrix</p>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[680px] border-collapse text-left">
              <thead>
                <tr className="border-b border-hairline">
                  {['Requirement', 'Section', 'Status', 'Confidence', 'Risk'].map((h) => (
                    <th key={h} className="label px-3 py-2 font-medium">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {result.findings.map((f) => (
                  <tr key={f.requirement.id} className="border-b border-hairline/40">
                    <td className="px-3 py-2 text-xs text-ink">{f.requirement.title}</td>
                    <td className="px-3 py-2 font-mono text-[0.66rem] text-ink-faint">
                      {f.requirement.section}
                    </td>
                    <td className="px-3 py-2">
                      <StatusBadge status={f.status} />
                    </td>
                    <td className="px-3 py-2 font-mono text-xs tabular-nums text-ink-dim">
                      {Math.round(f.confidence * 100)}%
                    </td>
                    <td className="px-3 py-2">
                      <RiskBadge level={f.risk} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        {/* Final status */}
        <section className="rounded-lg border border-neon/25 bg-neon/5 px-4 py-3">
          <p className="label mb-1">Final Compliance Status</p>
          <p className="font-mono text-sm font-bold uppercase tracking-[0.14em] text-neon">
            {result.verdict} — {result.score}/100
          </p>
          <p className="mt-2 text-[0.7rem] leading-relaxed text-ink-faint">
            This report is an automated preliminary assessment produced by rule-based clause matching and
            keyword/NLP analysis. It is not a legal opinion and does not replace review by a qualified legal
            professional. Ambiguous clauses are deliberately flagged rather than passed — verify every finding
            against the matched source text before acting on it.
          </p>
        </section>
      </div>
    </Card>
  );
}

/* ------------------------------- Scan history ------------------------------- */

const RISK_FILTERS: (RiskLevel | 'all')[] = ['all', 'critical', 'high', 'medium', 'low'];

function ScanHistory() {
  const { history, removeHistoryEntry, getResult, openResult } = useApp();
  const [query, setQuery] = useState('');
  const [risk, setRisk] = useState<RiskLevel | 'all'>('all');

  const rows = useMemo(
    () =>
      history.filter(
        (h) =>
          (risk === 'all' || h.riskLevel === risk) &&
          h.fileName.toLowerCase().includes(query.trim().toLowerCase()),
      ),
    [history, query, risk],
  );

  return (
    <Card className="no-print">
      <CardHeader
        title="Scan History"
        subtitle={`${history.length} scan${history.length === 1 ? '' : 's'} stored locally in this browser.`}
      />

      <div className="flex flex-wrap items-center gap-2 border-b border-hairline/70 px-4 py-3 sm:px-5">
        <div className="relative min-w-[180px] flex-1">
          <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-ink-faint" />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search documents…"
            aria-label="Search scan history"
            className="h-9 w-full rounded-lg border border-hairline bg-black/30 pl-8 pr-3 font-mono text-xs text-ink placeholder:text-ink-faint focus:border-neon/50 focus:outline-none"
          />
        </div>
        <div className="flex flex-wrap gap-1.5">
          {RISK_FILTERS.map((r) => (
            <button
              key={r}
              type="button"
              onClick={() => setRisk(r)}
              className={
                risk === r
                  ? 'rounded-md border border-neon/60 bg-neon/12 px-2.5 py-1 font-mono text-[0.62rem] font-semibold uppercase tracking-[0.1em] text-neon'
                  : 'rounded-md border border-hairline px-2.5 py-1 font-mono text-[0.62rem] font-semibold uppercase tracking-[0.1em] text-ink-faint hover:text-ink-dim'
              }
            >
              {r}
            </button>
          ))}
        </div>
      </div>

      {rows.length === 0 ? (
        <EmptyState
          title="No matching scans"
          description="Adjust the search or filter, or run a new compliance scan to add results here."
          action={
            <Link to="/scan">
              <Button variant="primary" size="sm">
                <Radar size={13} /> New Scan
              </Button>
            </Link>
          }
        />
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px] border-collapse text-left">
            <thead>
              <tr className="border-b border-hairline/70">
                {['Document', 'Date', 'Score', 'Risk', 'Status', 'Action'].map((h) => (
                  <th key={h} className="label px-4 py-2.5 font-medium">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((h) => {
                const cached = getResult(h.id);
                return (
                  <tr key={h.id} className="border-b border-hairline/50 transition-colors hover:bg-white/3">
                    <td className="max-w-[260px] px-4 py-3">
                      <p className="truncate text-sm text-ink" title={h.fileName}>
                        {h.fileName}
                      </p>
                      <p className="mt-0.5 font-mono text-[0.58rem] uppercase tracking-[0.12em] text-ink-faint">
                        {h.pages} pages · {formatNumber(h.words)} words
                        {h.demo ? ' · sample' : ''}
                      </p>
                    </td>
                    <td className="px-4 py-3 font-mono text-[0.68rem] text-ink-dim">
                      {formatDate(h.createdAt)}
                    </td>
                    <td className="px-4 py-3">
                      <span className="font-mono text-base font-bold tabular-nums text-ink">{h.score}</span>
                    </td>
                    <td className="px-4 py-3">
                      <RiskBadge level={h.riskLevel} />
                    </td>
                    <td className="px-4 py-3">
                      <Badge
                        tone={h.score >= 85 ? 'green' : h.score >= 60 ? 'cyan' : h.score >= 35 ? 'amber' : 'red'}
                      >
                        {h.verdict}
                      </Badge>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-1.5">
                        <Button
                          variant="ghost"
                          size="sm"
                          disabled={!cached}
                          title={cached ? 'Reopen this report' : 'Full result available only in the session it was scanned'}
                          onClick={() => cached && openResult(cached)}
                        >
                          View
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          disabled={!cached}
                          onClick={() => cached && downloadReportPdf(cached)}
                        >
                          Report
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          aria-label={`Delete scan of ${h.fileName}`}
                          onClick={() => removeHistoryEntry(h.id)}
                        >
                          <Trash2 size={14} />
                        </Button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  );
}

/* ---------------------------------- Page ----------------------------------- */

export default function Reports() {
  const { result } = useApp();

  return (
    <div className="space-y-6">
      <SectionHeading
        eyebrow="Deliverables"
        title="Compliance Reports"
        description="The full report for the current scan, plus every scan stored in this browser."
        action={
          <Link to="/scan" className="no-print">
            <Button variant="outline" size="sm">
              <Radar size={13} /> Run New Scan
            </Button>
          </Link>
        }
      />

      {result ? (
        <ReportViewer />
      ) : (
        <Card className="no-print">
          <EmptyState
            title="No active report"
            description="Run a compliance scan to generate a report. Past scans are listed below — reopen one from this session, or start a new scan."
            action={
              <Link to="/scan">
                <Button variant="solid" size="sm">
                  <Radar size={13} /> Start Compliance Scan
                </Button>
              </Link>
            }
          />
        </Card>
      )}

      <ScanHistory />
    </div>
  );
}
