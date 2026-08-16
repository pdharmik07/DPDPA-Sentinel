import { Link } from 'react-router-dom';
import { AlertOctagon, ChevronRight, FileBarChart2, RotateCcw } from 'lucide-react';
import { Button, Card, CardHeader, SectionHeading } from '@/components/ui/primitives';
import { UploadZone } from '@/components/scan/UploadZone';
import { ScanPipeline, ScanRunning, TerminalLog } from '@/components/scan/ScanProgress';
import {
  ComplianceMatrix,
  ExtractionPanel,
  NlpDashboard,
  Recommendations,
  RiskPanel,
  ScoreCard,
} from '@/components/scan/Results';
import { useApp } from '@/store/AppContext';
import { cn } from '@/lib/utils';

const STAGES = ['Upload', 'Scan', 'Analyze', 'Compare', 'Score', 'Report'] as const;

function Breadcrumb({ active }: { active: number }) {
  return (
    <div className="no-scrollbar flex items-center gap-1 overflow-x-auto pb-1">
      {STAGES.map((stage, i) => (
        <div key={stage} className="flex shrink-0 items-center gap-1">
          <span
            className={cn(
              'rounded-md border px-2.5 py-1 font-mono text-[0.6rem] font-semibold uppercase tracking-[0.14em] transition-colors',
              i < active
                ? 'border-matrix/35 bg-matrix/8 text-matrix'
                : i === active
                  ? 'border-neon/55 bg-neon/12 text-neon'
                  : 'border-hairline text-ink-faint',
            )}
          >
            {stage}
          </span>
          {i < STAGES.length - 1 ? <ChevronRight size={12} className="text-ink-faint/60" /> : null}
        </div>
      ))}
    </div>
  );
}

export default function Scan() {
  const { phase, result, failure, resetScan, startScan, file } = useApp();

  const activeStage =
    phase === 'idle' ? 0 : phase === 'ready' ? 1 : phase === 'scanning' ? 2 : phase === 'complete' ? 5 : 1;

  return (
    <div className="space-y-6">
      <SectionHeading
        eyebrow="Compliance Operations"
        title="Compliance Scan"
        description="Upload a privacy policy and run it through the seven-stage DPDPA analysis pipeline."
        action={
          phase === 'complete' || phase === 'error' ? (
            <Button variant="outline" size="sm" onClick={resetScan}>
              <RotateCcw size={13} /> Run New Scan
            </Button>
          ) : null
        }
      />

      <Breadcrumb active={activeStage} />

      {/* ---------------------------- Upload / idle ---------------------------- */}
      {(phase === 'idle' || phase === 'ready') && (
        <div className="grid gap-4 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)]">
          <UploadZone />
          <Card>
            <CardHeader
              title="Scan Pipeline"
              subtitle="Seven stages run in sequence once analysis starts."
            />
            <div className="p-4 sm:p-5">
              <ScanPipeline />
            </div>
          </Card>
        </div>
      )}

      {/* ------------------------------ Scanning ------------------------------- */}
      {phase === 'scanning' && <ScanRunning />}

      {/* -------------------------------- Error -------------------------------- */}
      {phase === 'error' && failure && (
        <Card className="border-alert/40">
          <div className="flex flex-col gap-4 p-5 sm:flex-row sm:items-start">
            <span className="grid h-11 w-11 shrink-0 place-items-center rounded-lg border border-alert/40 bg-alert/10 text-alert">
              <AlertOctagon size={20} />
            </span>
            <div className="min-w-0 flex-1">
              <p className="font-mono text-sm font-semibold uppercase tracking-[0.12em] text-alert">
                Scan failed — {failure.code.replace(/_/g, ' ')}
              </p>
              <p className="mt-1.5 text-sm text-ink">{failure.title}</p>
              <p className="mt-1 text-xs leading-relaxed text-ink-dim">{failure.hint}</p>
              <div className="mt-4 flex flex-wrap gap-2">
                <Button variant="outline" size="sm" onClick={resetScan}>
                  Choose another file
                </Button>
                {file ? (
                  <Button variant="primary" size="sm" onClick={startScan}>
                    Retry scan
                  </Button>
                ) : null}
              </div>
            </div>
          </div>
          <div className="border-t border-hairline/70 p-4 sm:p-5">
            <p className="label mb-2">Engine log</p>
            <TerminalLog />
          </div>
        </Card>
      )}

      {/* ------------------------------- Results -------------------------------- */}
      {phase === 'complete' && result && (
        <div className="space-y-4">
          <ScoreCard result={result} />
          <ExtractionPanel result={result} />
          <NlpDashboard result={result} />
          <ComplianceMatrix result={result} />
          <RiskPanel result={result} />
          <Recommendations result={result} />

          <Card className="flex flex-wrap items-center justify-between gap-3 p-4 sm:p-5">
            <div>
              <p className="font-mono text-[0.72rem] font-semibold uppercase tracking-[0.14em] text-ink">
                Analysis complete
              </p>
              <p className="mt-1 text-xs text-ink-faint">
                Open the full report to export, print or download it as PDF.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" size="sm" onClick={resetScan}>
                <RotateCcw size={13} /> Run New Scan
              </Button>
              <Link to="/reports">
                <Button variant="solid" size="sm">
                  <FileBarChart2 size={13} /> View Report
                </Button>
              </Link>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}
