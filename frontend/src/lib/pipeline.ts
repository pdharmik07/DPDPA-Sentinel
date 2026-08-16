/**
 * Scan pipeline driver.
 *
 * Previously this paced a local, in-browser analysis with sleep() calls. It now
 * drives the real backend: it uploads the document, then polls the scan's
 * status endpoint and advances the seven-step display from the server's actual
 * pipeline stage. The steps and their copy are unchanged, so the existing UI
 * renders exactly as before — but every transition now reflects real work.
 */

import { adaptScan } from './api/adapt';
import { ApiError } from './api/client';
import * as api from './api/endpoints';
import type { ScanStage, ScanStatus } from './api/types';
import type { ScanResult } from './dpdpa/types';
import { formatBytes, formatNumber } from './utils';

export type StepStatus = 'waiting' | 'scanning' | 'complete' | 'failed';

export interface PipelineStep {
  id: string;
  index: string;
  title: string;
  description: string;
  status: StepStatus;
}

export const PIPELINE_STEPS: Omit<PipelineStep, 'status'>[] = [
  {
    id: 'ingestion',
    index: '01',
    title: 'DOCUMENT INGESTION',
    description: 'Validate format, size and integrity of the uploaded policy.',
  },
  {
    id: 'extraction',
    index: '02',
    title: 'TEXT EXTRACTION',
    description: 'Recover machine-readable text and page structure from the file.',
  },
  {
    id: 'preprocessing',
    index: '03',
    title: 'DATA PREPROCESSING',
    description: 'Normalise whitespace, segment sentences and detect sections.',
  },
  {
    id: 'nlp',
    index: '04',
    title: 'NLP ANALYSIS',
    description: 'Identify privacy concepts, negation and hedging cues.',
  },
  {
    id: 'mapping',
    index: '05',
    title: 'DPDPA RULE MAPPING',
    description: 'Match clauses against the DPDPA requirement ontology.',
  },
  {
    id: 'scoring',
    index: '06',
    title: 'COMPLIANCE SCORING',
    description: 'Apply the weighted scoring formula across applicable clauses.',
  },
  {
    id: 'report',
    index: '07',
    title: 'REPORT GENERATION',
    description: 'Assemble findings, risks and remediation guidance.',
  },
];

export type LogTone = 'info' | 'ok' | 'warn' | 'error';

export interface ScanEvents {
  onStep: (stepId: string, status: StepStatus) => void;
  onProgress: (percent: number) => void;
  onLog: (line: string, tone?: LogTone) => void;
}

const STEP_IDS = PIPELINE_STEPS.map((s) => s.id);
const STEP_WEIGHT = 100 / PIPELINE_STEPS.length;

/** Which display step each server-side stage corresponds to. */
const STAGE_STEP: Record<ScanStage, string> = {
  UPLOADED: 'extraction',
  EXTRACTING: 'extraction',
  PREPROCESSING: 'preprocessing',
  ANALYZING: 'nlp',
  EVALUATING_RULES: 'mapping',
  SCORING: 'scoring',
  REPORTING: 'report',
  DONE: 'report',
};

const POLL_INTERVAL_MS = 700;
const POLL_TIMEOUT_MS = 180_000;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function runScanPipeline(file: File, events: ScanEvents): Promise<ScanResult> {
  const { onStep, onLog, onProgress } = events;

  /** Marks every step up to and including `stepId` complete. */
  let highWater = -1;
  const advanceTo = (stepId: string, running: boolean) => {
    const target = STEP_IDS.indexOf(stepId);
    if (target === -1) return;
    for (let i = 0; i <= target; i += 1) {
      const id = STEP_IDS[i];
      if (i < target) onStep(id, 'complete');
      else onStep(id, running ? 'scanning' : 'complete');
    }
    if (target > highWater) highWater = target;
    onProgress(Math.min(99, Math.round(STEP_WEIGHT * (target + (running ? 0.4 : 1)))));
  };

  // ── 01/02 Upload: the server validates and extracts synchronously ────────
  onStep('ingestion', 'scanning');
  onLog('Initializing compliance engine...');
  onLog(`Target acquired: ${file.name} (${formatBytes(file.size)})`);

  let created;
  try {
    created = await api.createScan(file);
  } catch (error) {
    onStep('ingestion', 'failed');
    if (error instanceof ApiError) onLog(`FATAL: ${error.message}`, 'error');
    throw error;
  }

  const scan = created.scan;
  onStep('ingestion', 'complete');
  onLog(
    `Document accepted — ${scan.pages ?? '?'} page(s), ${formatNumber(scan.words ?? 0)} words extracted`,
    'ok',
  );
  onStep('extraction', 'complete');
  onLog(
    `Segmented ${formatNumber(scan.sentences ?? 0)} sentences across ${formatNumber(scan.paragraphs ?? 0)} paragraphs`,
    'ok',
  );
  onProgress(Math.round(STEP_WEIGHT * 2));

  // ── 03-06 Poll the server's real pipeline stage ──────────────────────────
  const startedAt = Date.now();
  let status: ScanStatus = scan.status;
  let lastStage: ScanStage | null = null;
  let nlpNoted = false;

  while (status === 'QUEUED' || status === 'PROCESSING') {
    if (Date.now() - startedAt > POLL_TIMEOUT_MS) {
      onStep(STEP_IDS[Math.max(0, highWater)] ?? 'mapping', 'failed');
      throw new ApiError(
        408,
        'analysis_failed',
        'The analysis is taking longer than expected.',
        'Open Reports to check whether it finished, or run the scan again.',
      );
    }

    await sleep(POLL_INTERVAL_MS);

    const state = await api.getScanStatus(scan.id);
    status = state.status;

    if (state.stage !== lastStage) {
      lastStage = state.stage;
      advanceTo(STAGE_STEP[state.stage] ?? 'preprocessing', true);

      if (state.stage === 'ANALYZING') onLog('Identifying privacy concepts and consent mechanisms...');
      if (state.stage === 'EVALUATING_RULES') onLog('Mapping policy clauses to DPDPA requirements...');
      if (state.stage === 'SCORING') onLog('Applying weighted scoring formula...');
    }

    if (!nlpNoted && state.stage !== 'PREPROCESSING' && state.stage !== 'UPLOADED') {
      nlpNoted = true;
      onLog(
        state.nlpAvailable
          ? 'Semantic NLP layer engaged (advisory — rules remain deterministic)'
          : 'Semantic NLP service unavailable — using deterministic rule engine only',
        state.nlpAvailable ? 'ok' : 'warn',
      );
    }

    if (status === 'FAILED') {
      onStep(STEP_IDS[Math.max(0, highWater)] ?? 'mapping', 'failed');
      onLog(`FATAL: ${state.error ?? 'Analysis failed.'}`, 'error');
      throw new ApiError(
        500,
        'analysis_failed',
        state.error ?? 'Analysis failed.',
        'Try running the scan again, or upload a different export of the document.',
      );
    }
  }

  // ── 07 Fetch the completed result ────────────────────────────────────────
  advanceTo('scoring', false);
  onStep('report', 'scanning');
  onLog('Generating compliance report...');

  const detail = await api.getScan(scan.id);
  const result = adaptScan(detail);

  onLog(
    `Score = (${result.totals.earnedWeight} / ${result.totals.applicableWeight}) x 100 = ${result.score}`,
    'ok',
  );
  onLog(
    `Rule evaluation complete — ${result.totals.checked} applicable, ${result.totals.notApplicable} not triggered`,
    'ok',
  );
  onLog(`Risk level assessed: ${result.riskLevel.toUpperCase()}`, result.score >= 60 ? 'ok' : 'warn');

  const critical = result.risks.filter((r) => r.level === 'critical').length;
  onLog(`${result.risks.length} finding(s) recorded — ${critical} critical`, critical ? 'warn' : 'ok');
  onLog(`Verdict: ${result.verdict}`, result.score >= 60 ? 'ok' : 'error');
  onLog('Scan complete.', 'ok');

  onStep('report', 'complete');
  onProgress(100);

  return result;
}
