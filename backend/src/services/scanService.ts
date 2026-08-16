/**
 * Scan lifecycle: create, analyse, read, delete.
 *
 * Authorization rule for this whole module: every scan-scoped operation goes
 * through `assertScanOwned`, which filters by userId. There is no code path
 * that reads or mutates a scan by id alone, which is what prevents IDOR.
 */

import { env } from '../config/env.js';
import { logger } from '../config/logger.js';
import { prisma } from '../config/prisma.js';
import { analyzeDocument } from '../engine/analyze.js';
import { loadRulePack } from '../engine/rulePack.js';
import { prepareDocument } from '../engine/text.js';
import { priorityFor } from '../engine/recommendation.js';
import type { AnalysisResult } from '../engine/types.js';
import { AppError } from '../utils/errors.js';
import { extractText } from './extraction.js';
import { analyzeWithNlp } from './nlpClient.js';
import { JobQueue } from './queue.js';
import { safeDisplayName } from '../middleware/upload.js';

export const analysisQueue = new JobQueue(env.ANALYSIS_CONCURRENCY);

/**
 * Loads a scan and proves the caller owns it.
 * Returns 404 (not 403) for someone else's scan so the API does not confirm
 * that an id exists to a user who has no business knowing.
 */
export async function assertScanOwned(scanId: string, userId: string) {
  const scan = await prisma.scan.findFirst({ where: { id: scanId, userId } });
  if (!scan) throw AppError.notFound('Scan not found.');
  return scan;
}

export interface CreateScanInput {
  userId: string;
  buffer: Buffer;
  originalName: string;
  requestId?: string;
}

export async function createScan(input: CreateScanInput) {
  const displayName = safeDisplayName(input.originalName);

  // Extraction happens synchronously so the user learns immediately that a file
  // is a scanned image or corrupt, rather than after a round trip through the
  // queue. It is fast; the rule evaluation is what gets deferred.
  const extraction = await extractText(input.buffer, input.originalName);
  const doc = prepareDocument(extraction.text);

  const scan = await prisma.scan.create({
    data: {
      userId: input.userId,
      fileName: displayName,
      fileType: extraction.kind,
      fileSize: input.buffer.length,
      status: 'QUEUED',
      stage: 'PREPROCESSING',
      extractedText: extraction.text,
      pages: extraction.pages,
      words: doc.words,
      sentences: doc.sentences.length,
      paragraphs: doc.paragraphs.length,
      extractionRate: extraction.extractionRate,
    },
  });

  logger.info(
    {
      requestId: input.requestId,
      scanId: scan.id,
      userId: input.userId,
      kind: extraction.kind,
      pages: extraction.pages,
      words: doc.words,
    },
    'scan created',
  );

  analysisQueue.enqueue(scan.id, () => runAnalysis(scan.id, input.requestId));

  return scan;
}

/** Re-runs analysis for an existing scan (POST /api/scans/:id/analyze). */
export async function requeueAnalysis(scanId: string, userId: string, requestId?: string) {
  const scan = await assertScanOwned(scanId, userId);
  if (scan.status === 'PROCESSING') {
    throw AppError.conflict('conflict', 'This scan is already being analysed.', 'Wait for it to finish.');
  }
  if (!scan.extractedText) {
    throw AppError.badRequest(
      'analysis_failed',
      'This scan has no extracted text to analyse.',
      'Upload the document again.',
    );
  }

  await prisma.scan.update({
    where: { id: scanId },
    data: { status: 'QUEUED', stage: 'PREPROCESSING', error: null },
  });
  analysisQueue.enqueue(scanId, () => runAnalysis(scanId, requestId));
  return prisma.scan.findUniqueOrThrow({ where: { id: scanId } });
}

/**
 * The analysis pipeline. Stage transitions are persisted so the frontend's
 * seven-step progress display reflects real work rather than a timer.
 */
export async function runAnalysis(scanId: string, requestId?: string): Promise<void> {
  const started = Date.now();

  try {
    const scan = await prisma.scan.findUnique({ where: { id: scanId } });
    if (!scan?.extractedText) throw new Error('scan has no extracted text');

    await prisma.scan.update({
      where: { id: scanId },
      data: { status: 'PROCESSING', stage: 'PREPROCESSING', startedAt: new Date() },
    });

    const doc = prepareDocument(scan.extractedText);
    const pack = loadRulePack();

    // ── NLP (advisory, optional) ─────────────────────────────────────────
    await prisma.scan.update({ where: { id: scanId }, data: { stage: 'ANALYZING' } });
    const nlp = await analyzeWithNlp(doc, pack.rules, requestId);

    // ── Deterministic evaluation + scoring + risk ────────────────────────
    await prisma.scan.update({ where: { id: scanId }, data: { stage: 'EVALUATING_RULES' } });
    const result = analyzeDocument(doc, { nlp });

    await prisma.scan.update({ where: { id: scanId }, data: { stage: 'SCORING' } });
    await persistAnalysis(scanId, result);

    const durationMs = Date.now() - started;
    await prisma.scan.update({
      where: { id: scanId },
      data: {
        status: 'COMPLETED',
        stage: 'DONE',
        nlpAvailable: result.nlpAvailable,
        ruleVersion: result.ruleVersion,
        durationMs,
        completedAt: new Date(),
        error: null,
      },
    });

    logger.info(
      {
        requestId,
        scanId,
        durationMs,
        score: result.score.overallScore,
        risk: result.risk.level,
        nlpAvailable: result.nlpAvailable,
        pass: result.score.passedCount,
        partial: result.score.partialCount,
        fail: result.score.failedCount,
        notApplicable: result.score.notApplicableCount,
      },
      'analysis completed',
    );
  } catch (error) {
    logger.error({ requestId, scanId, err: error }, 'analysis failed');
    await prisma.scan
      .update({
        where: { id: scanId },
        data: {
          status: 'FAILED',
          stage: 'DONE',
          error: 'Analysis failed while evaluating the document.',
          durationMs: Date.now() - started,
          completedAt: new Date(),
        },
      })
      .catch(() => {
        /* the scan row may have been deleted mid-analysis; nothing to do */
      });
  }
}

async function persistAnalysis(scanId: string, result: AnalysisResult): Promise<void> {
  const findings = result.findings.map((f) => ({
    scanId,
    ruleId: f.ruleId,
    status: f.status,
    applicable: f.applicable,
    applicabilityReason: f.applicabilityReason,
    confidence: f.confidence,
    credit: f.credit,
    points: f.points,
    maxPoints: f.maxPoints,
    evidence: f.evidence as unknown as object,
    matchedSpecifics: f.matchedSpecifics,
    missingSpecifics: f.missingSpecifics,
    negationDetected: f.negationDetected,
    hedgingDetected: f.hedgingDetected,
    semanticSupport: f.semanticSupport,
    reasoning: f.reasoning,
    recommendation: f.rule.recommendation,
    remediation: f.rule.remediation,
    legalReference: f.legalReference,
    severity: f.severity,
    priority: f.status === 'PASS' || f.status === 'NOT_APPLICABLE' ? null : priorityFor(f),
  }));

  // One transaction so a scan is never left with a score but no findings.
  await prisma.$transaction([
    prisma.finding.deleteMany({ where: { scanId } }),
    prisma.scanScore.deleteMany({ where: { scanId } }),
    prisma.riskAssessment.deleteMany({ where: { scanId } }),
    prisma.finding.createMany({ data: findings }),
    prisma.scanScore.create({
      data: {
        scanId,
        overallScore: result.score.overallScore,
        verdict: result.score.verdict,
        scoringModel: result.score.scoringModel,
        earnedPoints: result.score.earnedPoints,
        maxPoints: result.score.maxPoints,
        passedCount: result.score.passedCount,
        partialCount: result.score.partialCount,
        failedCount: result.score.failedCount,
        notApplicableCount: result.score.notApplicableCount,
        categoryScores: result.score.categoryScores as unknown as object,
      },
    }),
    prisma.riskAssessment.create({
      data: {
        scanId,
        level: result.risk.level,
        explanation: result.risk.explanation,
        factors: result.risk.factors as unknown as object,
        criticalFindings: result.risk.criticalFindings,
        highFindings: result.risk.highFindings,
      },
    }),
  ]);
}

// ── Reads ───────────────────────────────────────────────────────────────────

export async function listScans(userId: string, limit = 50) {
  return prisma.scan.findMany({
    where: { userId },
    orderBy: { createdAt: 'desc' },
    take: limit,
    // extractedText is deliberately excluded from list responses.
    select: {
      id: true,
      fileName: true,
      fileType: true,
      fileSize: true,
      status: true,
      stage: true,
      error: true,
      pages: true,
      words: true,
      sentences: true,
      paragraphs: true,
      nlpAvailable: true,
      ruleVersion: true,
      durationMs: true,
      createdAt: true,
      completedAt: true,
      score: { select: { overallScore: true, verdict: true, passedCount: true, partialCount: true, failedCount: true, notApplicableCount: true, categoryScores: true } },
      risk: { select: { level: true } },
    },
  });
}

export async function getScanDetail(scanId: string, userId: string) {
  await assertScanOwned(scanId, userId);
  return prisma.scan.findUniqueOrThrow({
    where: { id: scanId },
    include: {
      score: true,
      risk: true,
      findings: { include: { rule: true }, orderBy: { ruleId: 'asc' } },
    },
  });
}

export async function getScanStatus(scanId: string, userId: string) {
  const scan = await assertScanOwned(scanId, userId);
  return {
    id: scan.id,
    status: scan.status,
    stage: scan.stage,
    error: scan.error,
    durationMs: scan.durationMs,
    nlpAvailable: scan.nlpAvailable,
  };
}

export async function getFindings(scanId: string, userId: string) {
  await assertScanOwned(scanId, userId);
  return prisma.finding.findMany({
    where: { scanId },
    include: { rule: true },
    orderBy: [{ status: 'asc' }, { ruleId: 'asc' }],
  });
}

export async function getScore(scanId: string, userId: string) {
  await assertScanOwned(scanId, userId);
  const score = await prisma.scanScore.findUnique({ where: { scanId } });
  if (!score) {
    throw AppError.badRequest(
      'scan_not_ready',
      'This scan has no score yet.',
      'Wait for the analysis to complete, then try again.',
    );
  }
  const risk = await prisma.riskAssessment.findUnique({ where: { scanId } });
  return { score, risk };
}

export async function deleteScan(scanId: string, userId: string): Promise<void> {
  await assertScanOwned(scanId, userId);
  // Findings, score, risk and reports cascade from the Scan row.
  await prisma.scan.delete({ where: { id: scanId } });
}

/**
 * Called at boot. Any scan still marked PROCESSING belongs to a previous
 * process that died mid-analysis; it can never complete, so fail it explicitly
 * rather than leaving the UI spinning forever.
 */
export async function recoverStuckScans(): Promise<number> {
  const { count } = await prisma.scan.updateMany({
    where: { status: { in: ['QUEUED', 'PROCESSING'] } },
    data: {
      status: 'FAILED',
      stage: 'DONE',
      error: 'Analysis was interrupted by a server restart. Run the scan again.',
    },
  });
  if (count > 0) logger.warn({ count }, 'recovered scans left in-flight by a previous process');
  return count;
}
