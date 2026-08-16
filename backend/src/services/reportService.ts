/**
 * Report generation — JSON and PDF.
 *
 * Both formats carry the same disclaimer and the same provenance metadata, so a
 * report can never be read as a compliance certificate.
 */

import { createWriteStream } from 'node:fs';
import { mkdir, stat } from 'node:fs/promises';
import { createHash, randomUUID } from 'node:crypto';
import path from 'node:path';
import PDFDocument from 'pdfkit';
import { env } from '../config/env.js';
import { prisma } from '../config/prisma.js';
import { loadRulePack, isEffectiveOn } from '../engine/rulePack.js';
import { assertScanOwned } from './scanService.js';
import { AppError } from '../utils/errors.js';
import { resolveWithin } from '../middleware/upload.js';

export const DISCLAIMER =
  'This tool provides an automated preliminary assessment based on configured DPDPA 2023 and ' +
  'DPDP Rules 2025 requirements. It is not a legal opinion, certification or substitute for ' +
  'review by a qualified legal/privacy professional.';

type ScanWithAll = Awaited<ReturnType<typeof loadScan>>;

async function loadScan(scanId: string, userId: string) {
  await assertScanOwned(scanId, userId);
  const scan = await prisma.scan.findUniqueOrThrow({
    where: { id: scanId },
    include: {
      score: true,
      risk: true,
      findings: { include: { rule: true }, orderBy: { ruleId: 'asc' } },
      user: { select: { name: true, email: true } },
    },
  });

  if (scan.status !== 'COMPLETED' || !scan.score) {
    throw AppError.badRequest(
      'scan_not_ready',
      'This scan has not finished analysing yet.',
      'Wait for the analysis to complete, then download the report again.',
    );
  }
  return scan;
}

// ── JSON ────────────────────────────────────────────────────────────────────

export async function buildJsonReport(scanId: string, userId: string) {
  const scan = await loadScan(scanId, userId);
  const pack = loadRulePack();
  const now = new Date();

  return {
    report: {
      type: 'DPDPA_PRELIMINARY_ASSESSMENT',
      generatedAt: now.toISOString(),
      tool: 'DPDPA Sentinel',
      disclaimer: DISCLAIMER,
    },
    framework: {
      name: 'DPDPA 2023 + DPDP Rules 2025',
      ruleVersion: scan.ruleVersion ?? pack.manifest.ruleVersion,
      legalVersion: pack.manifest.legalVersion,
      scoringModel: scan.score?.scoringModel,
      sourceUrl: pack.manifest.sourceUrl,
    },
    document: {
      fileName: scan.fileName,
      fileType: scan.fileType,
      fileSize: scan.fileSize,
      pages: scan.pages,
      words: scan.words,
      sentences: scan.sentences,
      paragraphs: scan.paragraphs,
      extractionRate: scan.extractionRate,
    },
    analysis: {
      scanId: scan.id,
      status: scan.status,
      durationMs: scan.durationMs,
      completedAt: scan.completedAt,
      nlpAvailable: scan.nlpAvailable,
      semanticLayerNote: scan.nlpAvailable
        ? 'Semantic similarity contributed to confidence scoring. All PASS/PARTIAL/FAIL decisions were made by the deterministic rule engine.'
        : 'The semantic NLP service was not available; this assessment used the deterministic rule engine alone.',
    },
    score: {
      overallScore: scan.score?.overallScore,
      verdict: scan.score?.verdict,
      earnedPoints: scan.score?.earnedPoints,
      maxPoints: scan.score?.maxPoints,
      passedCount: scan.score?.passedCount,
      partialCount: scan.score?.partialCount,
      failedCount: scan.score?.failedCount,
      notApplicableCount: scan.score?.notApplicableCount,
      categoryScores: scan.score?.categoryScores,
    },
    risk: {
      level: scan.risk?.level,
      explanation: scan.risk?.explanation,
      criticalFindings: scan.risk?.criticalFindings,
      highFindings: scan.risk?.highFindings,
      factors: scan.risk?.factors,
    },
    findings: scan.findings.map((f) => ({
      ruleId: f.ruleId,
      title: f.rule.title,
      category: f.rule.category,
      categoryLabel: f.rule.categoryLabel,
      status: f.status,
      applicable: f.applicable,
      applicabilityReason: f.applicabilityReason,
      severity: f.severity,
      priority: f.priority,
      weightClass: f.rule.weightClass,
      points: f.points,
      maxPoints: f.maxPoints,
      confidence: f.confidence,
      legal: {
        sourceType: f.rule.sourceType,
        reference: f.legalReference,
        actSection: f.rule.actSection,
        ruleReference: f.rule.ruleReference,
        scheduleReference: f.rule.scheduleReference,
        effectiveFrom: f.rule.effectiveFrom,
        effectiveNote: f.rule.effectiveNote,
        inForce: isEffectiveOn(
          { ...f.rule, effectiveFrom: f.rule.effectiveFrom?.toISOString() ?? null, effectiveTo: f.rule.effectiveTo?.toISOString() ?? null } as never,
          now,
        ),
      },
      evidence: f.evidence,
      matchedSpecifics: f.matchedSpecifics,
      missingSpecifics: f.missingSpecifics,
      negationDetected: f.negationDetected,
      hedgingDetected: f.hedgingDetected,
      semanticSupport: f.semanticSupport,
      reasoning: f.reasoning,
      recommendation: f.recommendation,
      remediation: f.remediation,
    })),
  };
}

// ── PDF ─────────────────────────────────────────────────────────────────────

const COLORS = {
  ink: '#101418',
  muted: '#5b6672',
  rule: '#d7dde3',
  pass: '#1a7f4b',
  partial: '#a76a00',
  fail: '#b3261e',
  na: '#6b7280',
  accent: '#0b4f9c',
};

function statusColor(status: string): string {
  if (status === 'PASS') return COLORS.pass;
  if (status === 'PARTIAL') return COLORS.partial;
  if (status === 'FAIL') return COLORS.fail;
  return COLORS.na;
}

export async function generatePdfReport(scanId: string, userId: string): Promise<{ filePath: string; fileSize: number; checksum: string }> {
  const scan = await loadScan(scanId, userId);

  const dir = path.resolve(env.REPORT_DIR);
  await mkdir(dir, { recursive: true });
  const filePath = resolveWithin(dir, `dpdpa-report-${scan.id}-${randomUUID()}.pdf`);

  const doc = new PDFDocument({ size: 'A4', margin: 50, bufferPages: true, info: {
    Title: `DPDPA Sentinel — Preliminary Assessment — ${scan.fileName}`,
    Author: 'DPDPA Sentinel',
    Subject: 'Automated preliminary DPDPA 2023 / DPDP Rules 2025 assessment',
  } });

  const hash = createHash('sha256');
  const out = createWriteStream(filePath);
  doc.on('data', (chunk: Buffer) => hash.update(chunk));

  const finished = new Promise<void>((resolve, reject) => {
    out.on('finish', () => resolve());
    out.on('error', reject);
  });
  doc.pipe(out);

  renderPdf(doc, scan);
  doc.end();
  await finished;

  const { size } = await stat(filePath);
  return { filePath, fileSize: size, checksum: hash.digest('hex') };
}

function renderPdf(doc: PDFKit.PDFDocument, scan: ScanWithAll): void {
  const score = scan.score;
  const risk = scan.risk;
  const W = doc.page.width - 100;

  const heading = (text: string, size = 15) => {
    if (doc.y > doc.page.height - 140) doc.addPage();
    doc.moveDown(0.8).fillColor(COLORS.ink).font('Helvetica-Bold').fontSize(size).text(text);
    doc.moveTo(50, doc.y + 3).lineTo(50 + W, doc.y + 3).strokeColor(COLORS.rule).lineWidth(1).stroke();
    doc.moveDown(0.6);
  };
  const body = (text: string, opts: { color?: string; size?: number; bold?: boolean } = {}) => {
    doc
      .fillColor(opts.color ?? COLORS.ink)
      .font(opts.bold ? 'Helvetica-Bold' : 'Helvetica')
      .fontSize(opts.size ?? 10)
      .text(text, { width: W, align: 'left' });
  };

  // ── Cover ───────────────────────────────────────────────────────────────
  doc.fillColor(COLORS.accent).font('Helvetica-Bold').fontSize(30).text('DPDPA SENTINEL', { align: 'left' });
  doc.fillColor(COLORS.muted).font('Helvetica').fontSize(12).text('Automated Preliminary Compliance Assessment');
  doc.moveDown(2);

  doc.fillColor(COLORS.ink).font('Helvetica-Bold').fontSize(16).text(scan.fileName);
  doc.moveDown(0.5);
  doc.font('Helvetica').fontSize(10).fillColor(COLORS.muted);
  doc.text(`Assessed: ${new Date(scan.completedAt ?? Date.now()).toUTCString()}`);
  doc.text(`Document: ${scan.fileType.toUpperCase()} · ${scan.pages ?? '—'} page(s) · ${scan.words ?? '—'} words`);
  doc.text(`Rule set: DPDPA 2023 + DPDP Rules 2025 · rule pack v${scan.ruleVersion ?? '1.0.0'}`);
  doc.text(`Scoring model: ${score?.scoringModel ?? 'design-doc-1.0'}`);
  doc.text(
    `Semantic NLP layer: ${scan.nlpAvailable ? 'available (advisory only)' : 'not available — deterministic rules only'}`,
  );

  doc.moveDown(2);
  doc.roundedRect(50, doc.y, W, 96, 6).fillAndStroke('#f4f7fa', COLORS.rule);
  const boxTop = doc.y + 16;
  doc.fillColor(COLORS.ink).font('Helvetica-Bold').fontSize(40).text(`${score?.overallScore ?? 0}`, 70, boxTop, { continued: true });
  doc.font('Helvetica').fontSize(14).fillColor(COLORS.muted).text('  / 100');
  doc.font('Helvetica-Bold').fontSize(13).fillColor(COLORS.ink).text(`${score?.verdict ?? ''}`, 70, boxTop + 52);
  doc.font('Helvetica-Bold').fontSize(13).fillColor(riskColor(risk?.level)).text(`RISK: ${risk?.level ?? '—'}`, 320, boxTop + 52);
  doc.y = boxTop + 96;

  doc.moveDown(1.5);
  doc.font('Helvetica-Oblique').fontSize(9).fillColor(COLORS.muted).text(DISCLAIMER, { width: W });

  // ── Executive summary ───────────────────────────────────────────────────
  doc.addPage();
  heading('Executive Summary');
  body(
    `This report records an automated preliminary assessment of "${scan.fileName}" against ${
      scan.findings.length
    } configured requirements derived from the Digital Personal Data Protection Act, 2023 and the Digital Personal Data Protection Rules, 2025.`,
  );
  doc.moveDown(0.5);
  body(
    `${score?.passedCount ?? 0} requirement(s) passed, ${score?.partialCount ?? 0} were partially satisfied, ${
      score?.failedCount ?? 0
    } failed, and ${score?.notApplicableCount ?? 0} were not applicable to this document and were excluded from scoring.`,
  );
  doc.moveDown(0.5);
  body(`Points earned: ${score?.earnedPoints ?? 0} of ${score?.maxPoints ?? 0} available across applicable requirements.`);

  heading('Risk Assessment', 13);
  body(`Level: ${risk?.level ?? '—'}`, { bold: true, color: riskColor(risk?.level) });
  doc.moveDown(0.3);
  body(risk?.explanation ?? '');
  const factors = (risk?.factors as { label: string; triggered: boolean; detail: string }[] | undefined) ?? [];
  const triggered = factors.filter((f) => f.triggered);
  if (triggered.length) {
    doc.moveDown(0.5);
    body('Triggered risk factors:', { bold: true });
    for (const f of triggered) body(`  • ${f.label} — ${f.detail}`, { size: 9, color: COLORS.muted });
  }

  // ── Category breakdown ──────────────────────────────────────────────────
  heading('Category Breakdown');
  const cats = (score?.categoryScores as { label: string; score: number; earned: number; possible: number; rules: number }[] | undefined) ?? [];
  for (const c of cats) {
    if (doc.y > doc.page.height - 90) doc.addPage();
    const y = doc.y;
    doc.font('Helvetica').fontSize(9.5).fillColor(COLORS.ink).text(c.label, 50, y, { width: 250 });
    doc.text(`${c.earned} / ${c.possible} pts`, 305, y, { width: 80 });
    doc.text(`${c.rules} rule(s)`, 390, y, { width: 70 });
    doc.font('Helvetica-Bold').text(`${c.score}%`, 465, y, { width: 60, align: 'right' });
    const barY = y + 14;
    doc.rect(50, barY, W, 4).fill('#e9eef3');
    doc.rect(50, barY, Math.max(2, (W * c.score) / 100), 4).fill(barColor(c.score));
    doc.y = barY + 12;
  }

  // ── Findings by status ──────────────────────────────────────────────────
  for (const group of ['FAIL', 'PARTIAL', 'PASS', 'NOT_APPLICABLE'] as const) {
    const items = scan.findings.filter((f) => f.status === group);
    if (!items.length) continue;

    heading(`${labelFor(group)} (${items.length})`);
    for (const f of items) {
      if (doc.y > doc.page.height - 150) doc.addPage();

      doc.font('Helvetica-Bold').fontSize(10).fillColor(statusColor(f.status)).text(`[${f.status}] `, { continued: true });
      doc.fillColor(COLORS.ink).text(`${f.ruleId} — ${f.rule.title}`);
      doc.font('Helvetica').fontSize(8.5).fillColor(COLORS.muted);
      doc.text(
        `${f.rule.categoryLabel} · ${f.rule.weightClass} · severity ${f.severity} · ${f.points}/${f.maxPoints} pts` +
          (f.status !== 'NOT_APPLICABLE' ? ` · confidence ${(f.confidence * 100).toFixed(0)}%` : ''),
      );
      doc.text(`Legal basis: ${f.legalReference ?? '—'} (${f.rule.sourceType.replace('_', ' ').toLowerCase()})`);
      if (f.rule.effectiveFrom) {
        doc.text(`Rules-2025 provision comes into force: ${f.rule.effectiveFrom.toISOString().slice(0, 10)}`);
      }

      doc.moveDown(0.25);
      doc.font('Helvetica').fontSize(9).fillColor(COLORS.ink).text(f.reasoning, { width: W });

      const evidence = (f.evidence as { sentence: string; negated: boolean; hedged: boolean }[] | undefined) ?? [];
      if (evidence.length && f.status !== 'NOT_APPLICABLE') {
        doc.moveDown(0.25);
        doc.font('Helvetica-Bold').fontSize(8.5).fillColor(COLORS.muted).text('Evidence from the document:');
        for (const e of evidence.slice(0, 3)) {
          const flags = [e.negated ? 'negated' : null, e.hedged ? 'hedged' : null].filter(Boolean).join(', ');
          doc
            .font('Helvetica-Oblique')
            .fontSize(8.5)
            .fillColor('#37424e')
            .text(`  “${truncate(e.sentence, 300)}”${flags ? `  [${flags}]` : ''}`, { width: W - 10 });
        }
      }

      if (f.missingSpecifics.length && f.status !== 'NOT_APPLICABLE') {
        doc.font('Helvetica').fontSize(8.5).fillColor(COLORS.muted).text(`Missing: ${f.missingSpecifics.join('; ')}`);
      }
      doc.moveDown(0.7);
    }
  }

  // ── Recommendations ─────────────────────────────────────────────────────
  const actionable = scan.findings
    .filter((f) => f.priority && (f.status === 'FAIL' || f.status === 'PARTIAL'))
    .sort((a, b) => rankPriority(a.priority) - rankPriority(b.priority));

  if (actionable.length) {
    doc.addPage();
    heading('Recommendations and Remediation Priorities');
    body(
      'Items are ordered by remediation priority. Each entry states the legal basis and whether it is a statutory requirement or a recommended practice.',
      { color: COLORS.muted, size: 9 },
    );
    doc.moveDown(0.5);

    for (const f of actionable) {
      if (doc.y > doc.page.height - 160) doc.addPage();
      doc.font('Helvetica-Bold').fontSize(9.5).fillColor(priorityColor(f.priority)).text(`[${f.priority}] `, { continued: true });
      doc.fillColor(COLORS.ink).text(`${f.ruleId} — ${f.rule.title}`);
      doc.font('Helvetica').fontSize(8.5).fillColor(COLORS.muted).text(`${f.legalReference ?? '—'} · ${sourceLabel(f.rule.sourceType)}`);
      doc.moveDown(0.2);
      doc.font('Helvetica').fontSize(9).fillColor(COLORS.ink).text(`Recommendation: ${f.recommendation ?? ''}`, { width: W });
      if (f.remediation) doc.text(`Remediation: ${f.remediation}`, { width: W });
      doc.moveDown(0.6);
    }
  }

  // ── Legal references ────────────────────────────────────────────────────
  doc.addPage();
  heading('Legal References');
  body(
    'Every requirement in this assessment is traceable to the supplied source documents. Where a citation could not be established from those sources it is marked as requiring verification.',
    { size: 9, color: COLORS.muted },
  );
  doc.moveDown(0.5);

  const seen = new Set<string>();
  for (const f of scan.findings) {
    const key = f.legalReference ?? f.ruleId;
    if (seen.has(key)) continue;
    seen.add(key);
    if (doc.y > doc.page.height - 90) doc.addPage();
    doc.font('Helvetica-Bold').fontSize(8.5).fillColor(COLORS.ink).text(`${f.ruleId}: `, { continued: true });
    doc.font('Helvetica').fillColor(COLORS.muted).text(`${key} — ${sourceLabel(f.rule.sourceType)}`);
    if (f.rule.effectiveNote) {
      doc.font('Helvetica-Oblique').fontSize(8).fillColor('#7a838d').text(`    ${f.rule.effectiveNote}`, { width: W - 10 });
    }
  }

  // ── Disclaimer ──────────────────────────────────────────────────────────
  heading('Disclaimer');
  doc.font('Helvetica').fontSize(9.5).fillColor(COLORS.ink).text(DISCLAIMER, { width: W });
  doc.moveDown(0.5);
  doc
    .font('Helvetica')
    .fontSize(8.5)
    .fillColor(COLORS.muted)
    .text(
      'Findings are produced by deterministic pattern and structure analysis of the submitted text. ' +
        'Where a semantic language model was available it contributed only to confidence scoring; it did not determine any pass, partial or fail outcome. ' +
        'An absence of evidence in the document is not proof that a control does not exist in the organisation.',
      { width: W },
    );

  // Page numbers.
  const range = doc.bufferedPageRange();
  for (let i = range.start; i < range.start + range.count; i += 1) {
    doc.switchToPage(i);
    doc
      .font('Helvetica')
      .fontSize(8)
      .fillColor(COLORS.muted)
      .text(
        `DPDPA Sentinel · automated preliminary assessment · page ${i - range.start + 1} of ${range.count}`,
        50,
        doc.page.height - 35,
        { width: W, align: 'center' },
      );
  }
}

function labelFor(status: string): string {
  return {
    FAIL: 'Failed Requirements',
    PARTIAL: 'Partially Satisfied Requirements',
    PASS: 'Satisfied Requirements',
    NOT_APPLICABLE: 'Not Applicable (excluded from scoring)',
  }[status] ?? status;
}

function sourceLabel(sourceType: string): string {
  return {
    ACT: 'DPDP Act 2023 statutory requirement',
    RULES_2025: 'DPDP Rules 2025 requirement',
    PROJECT_SPECIFIC: 'project-specific technical check (not a statutory clause)',
    BEST_PRACTICE: 'recommended best practice (not a statutory clause)',
  }[sourceType] ?? sourceType;
}

function riskColor(level?: string | null): string {
  return { LOW: COLORS.pass, MEDIUM: COLORS.partial, HIGH: '#d1541c', CRITICAL: COLORS.fail }[level ?? ''] ?? COLORS.muted;
}

function priorityColor(p?: string | null): string {
  return { LOW: COLORS.na, MEDIUM: COLORS.partial, HIGH: '#d1541c', CRITICAL: COLORS.fail }[p ?? ''] ?? COLORS.muted;
}

function barColor(score: number): string {
  if (score >= 80) return COLORS.pass;
  if (score >= 50) return COLORS.partial;
  return COLORS.fail;
}

function rankPriority(p?: string | null): number {
  return { CRITICAL: 0, HIGH: 1, MEDIUM: 2, LOW: 3 }[p ?? ''] ?? 9;
}

function truncate(s: string, n: number): string {
  return s.length <= n ? s : `${s.slice(0, n - 1).trimEnd()}…`;
}

/** Records the generated report so downloads can be audited and re-served. */
export async function recordReport(scanId: string, type: 'PDF' | 'JSON', info?: { filePath: string; fileSize: number; checksum: string }) {
  return prisma.report.create({
    data: {
      scanId,
      reportType: type,
      filePath: info?.filePath ?? null,
      fileSize: info?.fileSize ?? null,
      checksum: info?.checksum ?? null,
    },
  });
}
