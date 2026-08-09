import { extractText, ExtractionError } from './dpdpa/extract';
import { runAnalysis } from './dpdpa/analyze';
import { REQUIREMENTS } from './dpdpa/requirements';
import type { ScanResult } from './dpdpa/types';
import { formatBytes, formatNumber, sleep } from './utils';

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

export interface ScanEvents {
  onStep: (stepId: string, status: StepStatus) => void;
  onProgress: (percent: number) => void;
  onLog: (line: string, tone?: LogTone) => void;
}

export type LogTone = 'info' | 'ok' | 'warn' | 'error';

const STEP_WEIGHT = 100 / PIPELINE_STEPS.length;

function progressAt(stepIndex: number, fraction = 1): number {
  return Math.min(100, Math.round(STEP_WEIGHT * (stepIndex + fraction)));
}

/**
 * Drives the seven-stage scan. Every log line and every number reported here
 * comes from the real document — the pacing is presentational, the results are not.
 */
export async function runScanPipeline(
  file: File,
  events: ScanEvents,
  opts: { pace: number } = { pace: 1 },
): Promise<ScanResult> {
  const started = performance.now();
  const pace = (ms: number) => sleep(ms * opts.pace);
  const { onStep, onProgress, onLog } = events;

  // ── 01 Document ingestion ────────────────────────────────────────────────
  onStep('ingestion', 'scanning');
  onLog('Initializing compliance engine...');
  await pace(320);
  onLog(`Target acquired: ${file.name} (${formatBytes(file.size)})`);
  onLog(`Loaded DPDPA rule set — ${REQUIREMENTS.length} clause categories`, 'ok');
  await pace(300);
  onStep('ingestion', 'complete');
  onProgress(progressAt(0));

  // ── 02 Text extraction ───────────────────────────────────────────────────
  onStep('extraction', 'scanning');
  onLog('Extracting policy content...');
  await pace(240);

  let extraction;
  try {
    extraction = await extractText(file);
  } catch (error) {
    onStep('extraction', 'failed');
    const message = error instanceof ExtractionError ? error.message : 'Text extraction failed.';
    onLog(`FATAL: ${message}`, 'error');
    throw error;
  }

  onLog(
    `Document successfully loaded — ${extraction.pages} page(s), ${formatNumber(extraction.text.length)} characters`,
    'ok',
  );
  if (extraction.extractionRate < 0.9) {
    onLog(
      `Warning: only ${Math.round(extraction.extractionRate * 100)}% of pages yielded text`,
      'warn',
    );
  }
  await pace(360);
  onStep('extraction', 'complete');
  onProgress(progressAt(1));

  // ── 03 Preprocessing ─────────────────────────────────────────────────────
  onStep('preprocessing', 'scanning');
  onLog('Normalizing whitespace and tokenizing...');
  await pace(300);

  // The analysis itself is synchronous and fast; run it once here and report
  // real figures through the remaining stages.
  const result = runAnalysis({
    text: extraction.text,
    fileName: file.name,
    fileSize: file.size,
    fileType: extraction.kind,
    pages: extraction.pages,
    extractionRate: extraction.extractionRate,
    durationMs: 0,
  });

  onLog(
    `Segmented ${formatNumber(result.stats.sentences)} sentences across ${formatNumber(result.stats.paragraphs)} paragraphs`,
    'ok',
  );
  onLog(`Detected ${result.stats.sections} document sections`);
  await pace(320);
  onStep('preprocessing', 'complete');
  onProgress(progressAt(2));

  // ── 04 NLP analysis ──────────────────────────────────────────────────────
  onStep('nlp', 'scanning');
  onLog('Identifying personal data references...');
  await pace(280);

  const strongConcepts = result.concepts.filter((c) => c.detected === 'yes');
  const missingConcepts = result.concepts.filter((c) => c.detected === 'no');
  onLog(`Concept model matched ${strongConcepts.length}/${result.concepts.length} privacy concepts`, 'ok');
  onLog('Detecting consent mechanisms...');
  await pace(260);

  const negated = result.findings.filter((f) => f.negationDetected).length;
  const hedged = result.findings.filter((f) => f.hedgingDetected).length;
  if (negated) onLog(`Negation cues found in ${negated} clause context(s)`, 'warn');
  if (hedged) onLog(`Hedging language found in ${hedged} clause context(s)`, 'warn');
  if (missingConcepts.length) {
    onLog(`Absent concepts: ${missingConcepts.slice(0, 3).map((c) => c.label).join(', ')}`, 'warn');
  }
  await pace(300);
  onStep('nlp', 'complete');
  onProgress(progressAt(3));

  // ── 05 DPDPA rule mapping ────────────────────────────────────────────────
  onStep('mapping', 'scanning');
  onLog('Mapping policy clauses to DPDPA requirements...');

  const sample = result.findings.slice(0, 6);
  for (let i = 0; i < sample.length; i += 1) {
    const finding = sample[i];
    const mark =
      finding.status === 'compliant' ? 'MATCH' : finding.status === 'partial' ? 'PARTIAL' : 'GAP';
    const tone: LogTone =
      finding.status === 'compliant' ? 'ok' : finding.status === 'partial' ? 'warn' : 'error';
    onLog(`[${finding.requirement.code}] ${finding.requirement.title} → ${mark}`, tone);
    onProgress(progressAt(4, (i + 1) / sample.length));
    await pace(130);
  }
  onLog(
    `Rule mapping complete — ${result.totals.checked} applicable, ${result.totals.notApplicable} not triggered`,
    'ok',
  );
  await pace(240);
  onStep('mapping', 'complete');
  onProgress(progressAt(4));

  // ── 06 Compliance scoring ────────────────────────────────────────────────
  onStep('scoring', 'scanning');
  onLog('Applying weighted scoring formula...');
  await pace(300);
  onLog(
    `Score = (${result.totals.earnedWeight.toFixed(1)} / ${result.totals.applicableWeight.toFixed(1)}) x 100 = ${result.score}`,
    'ok',
  );
  onLog(`Risk level assessed: ${result.riskLevel.toUpperCase()}`, result.score >= 60 ? 'ok' : 'warn');
  await pace(320);
  onStep('scoring', 'complete');
  onProgress(progressAt(5));

  // ── 07 Report generation ─────────────────────────────────────────────────
  onStep('report', 'scanning');
  onLog('Generating compliance report...');
  await pace(340);
  const critical = result.risks.filter((r) => r.level === 'critical').length;
  onLog(
    `${result.risks.length} finding(s) recorded — ${critical} critical`,
    critical ? 'warn' : 'ok',
  );
  onLog(`Verdict: ${result.verdict}`, result.score >= 60 ? 'ok' : 'error');
  onLog('Scan complete.', 'ok');
  onStep('report', 'complete');
  onProgress(100);

  return { ...result, durationMs: Math.round(performance.now() - started) };
}
