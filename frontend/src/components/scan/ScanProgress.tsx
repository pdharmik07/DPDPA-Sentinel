import { useEffect, useRef } from 'react';
import { Check, CircleDashed, Loader2, TriangleAlert } from 'lucide-react';
import { Card, CardHeader, Progress } from '@/components/ui/primitives';
import { cn } from '@/lib/utils';
import { useApp } from '@/store/AppContext';
import type { PipelineStep } from '@/lib/pipeline';

const TONE: Record<string, string> = {
  info: 'text-ink-dim',
  ok: 'text-matrix',
  warn: 'text-signal',
  error: 'text-alert',
};

function StepRow({ step, compact = false }: { step: PipelineStep; compact?: boolean }) {
  const icon =
    step.status === 'complete' ? (
      <Check size={13} className="text-matrix" />
    ) : step.status === 'scanning' ? (
      <Loader2 size={13} className="animate-spin text-neon" />
    ) : step.status === 'failed' ? (
      <TriangleAlert size={13} className="text-alert" />
    ) : (
      <CircleDashed size={13} className="text-ink-faint" />
    );

  const statusText =
    step.status === 'complete'
      ? 'Complete'
      : step.status === 'scanning'
        ? 'Scanning'
        : step.status === 'failed'
          ? 'Failed'
          : 'Waiting';

  return (
    <div
      className={cn(
        'relative flex items-start gap-3 rounded-lg border px-3 py-2.5 transition-colors',
        step.status === 'scanning'
          ? 'border-neon/45 bg-neon/8'
          : step.status === 'complete'
            ? 'border-matrix/25 bg-matrix/4'
            : step.status === 'failed'
              ? 'border-alert/40 bg-alert/8'
              : 'border-hairline bg-white/2',
      )}
    >
      <span className="mt-0.5 font-mono text-[0.68rem] font-bold text-ink-faint">{step.index}</span>
      <div className="min-w-0 flex-1">
        <div className="flex items-center justify-between gap-2">
          <p
            className={cn(
              'truncate font-mono text-[0.68rem] font-semibold uppercase tracking-[0.12em]',
              step.status === 'waiting' ? 'text-ink-dim' : 'text-ink',
            )}
          >
            {step.title}
          </p>
          <span className="flex shrink-0 items-center gap-1.5">
            {icon}
            <span
              className={cn(
                'font-mono text-[0.6rem] uppercase tracking-[0.14em]',
                step.status === 'complete'
                  ? 'text-matrix'
                  : step.status === 'scanning'
                    ? 'text-neon'
                    : step.status === 'failed'
                      ? 'text-alert'
                      : 'text-ink-faint',
              )}
            >
              {statusText}
            </span>
          </span>
        </div>
        {!compact ? (
          <p className="mt-1 text-[0.68rem] leading-relaxed text-ink-faint">{step.description}</p>
        ) : null}
        {step.status === 'scanning' ? (
          <Progress value={65} className="mt-2 h-1" showSweep />
        ) : null}
      </div>
    </div>
  );
}

export function ScanPipeline({ compact = false }: { compact?: boolean }) {
  const { steps } = useApp();
  return (
    <div className={cn('grid gap-2', compact ? 'grid-cols-1' : 'sm:grid-cols-2 lg:grid-cols-1')}>
      {steps.map((step) => (
        <StepRow key={step.id} step={step} compact={compact} />
      ))}
    </div>
  );
}

export function TerminalLog() {
  const { logs } = useApp();
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: 'nearest' });
  }, [logs.length]);

  return (
    <div className="terminal max-h-72 overflow-y-auto rounded-lg p-3 sm:max-h-80">
      {logs.length === 0 ? (
        <p className="text-ink-faint">
          <span className="text-neon">$</span> awaiting scan initialisation
          <span className="ml-0.5 animate-blink text-neon">▌</span>
        </p>
      ) : (
        logs.map((log) => (
          <p key={log.id} className="flex gap-2">
            <span className="shrink-0 text-ink-faint/70">{log.at}</span>
            <span className="shrink-0 text-neon">›</span>
            <span className={cn('min-w-0 break-words', TONE[log.tone])}>{log.text}</span>
          </p>
        ))
      )}
      <div ref={endRef} />
    </div>
  );
}

export function ScanRunning() {
  const { progress, phase } = useApp();

  return (
    <Card className="overflow-hidden">
      <CardHeader
        title="DPDPA Compliance Scan in Progress"
        subtitle="Live pipeline telemetry — every figure below is computed from your document."
        action={
          <span className="font-mono text-2xl font-bold tabular-nums text-neon text-glow">
            {Math.round(progress)}%
          </span>
        }
      />

      <div className="px-4 pt-4 sm:px-5">
        <div className="mb-1.5 flex items-center justify-between">
          <span className="label">Scan Progress</span>
          <span className="font-mono text-[0.66rem] uppercase tracking-[0.14em] text-ink-dim">
            {phase === 'scanning' ? 'Engine active' : 'Idle'}
          </span>
        </div>
        <Progress value={progress} showSweep={phase === 'scanning'} className="h-2" />
      </div>

      <div className="grid gap-4 p-4 sm:p-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
        <ScanPipeline compact />
        <div>
          <p className="label mb-2">Engine Log</p>
          <TerminalLog />
        </div>
      </div>
    </Card>
  );
}
