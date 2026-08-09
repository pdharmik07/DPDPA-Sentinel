import { jsPDF } from 'jspdf';
import type { ScanResult } from './dpdpa/types';
import { STATUS_TEXT } from './dpdpa/labels';
import { formatBytes, formatDate } from './utils';

/** Text-based PDF so the export stays small and selectable/searchable. */
export function downloadReportPdf(result: ScanResult): void {
  const doc = new jsPDF({ unit: 'pt', format: 'a4' });
  const margin = 48;
  const width = doc.internal.pageSize.getWidth();
  const bottom = doc.internal.pageSize.getHeight() - 56;
  let y = margin;

  const nextPage = () => {
    doc.addPage();
    y = margin;
  };
  const space = (needed: number) => {
    if (y + needed > bottom) nextPage();
  };

  const heading = (text: string, size = 13) => {
    space(size + 18);
    doc.setFont('helvetica', 'bold').setFontSize(size).setTextColor(15, 26, 45);
    doc.text(text, margin, y);
    y += size + 8;
  };

  const body = (text: string, size = 9.5) => {
    doc.setFont('helvetica', 'normal').setFontSize(size).setTextColor(52, 66, 88);
    for (const line of doc.splitTextToSize(text, width - margin * 2)) {
      space(size + 4);
      doc.text(line, margin, y);
      y += size + 3.5;
    }
    y += 4;
  };

  const kv = (rows: [string, string][]) => {
    doc.setFontSize(9.5);
    for (const [k, v] of rows) {
      space(16);
      doc.setFont('helvetica', 'bold').setTextColor(15, 26, 45);
      doc.text(`${k}:`, margin, y);
      doc.setFont('helvetica', 'normal').setTextColor(52, 66, 88);
      doc.text(doc.splitTextToSize(v, width - margin * 2 - 150), margin + 150, y);
      y += 15;
    }
    y += 6;
  };

  // ── Cover block ─────────────────────────────────────────────────────────
  doc.setFillColor(7, 11, 22).rect(0, 0, width, 104, 'F');
  doc.setFont('helvetica', 'bold').setFontSize(19).setTextColor(255, 255, 255);
  doc.text('DPDPA COMPLIANCE REPORT', margin, 50);
  doc.setFont('helvetica', 'normal').setFontSize(10).setTextColor(140, 190, 220);
  doc.text('DPDPA Sentinel — Privacy Compliance Intelligence', margin, 70);
  doc.setFontSize(8.5).setTextColor(120, 150, 180);
  doc.text(`Report ID: ${result.id}   |   Generated: ${formatDate(result.createdAt)}`, margin, 88);
  y = 138;

  heading('Document Information');
  kv([
    ['File name', result.stats.fileName],
    ['Analysis date', formatDate(result.createdAt)],
    ['Document size', formatBytes(result.stats.fileSize)],
    ['Pages', String(result.stats.pages)],
    ['Words', result.stats.words.toLocaleString('en-IN')],
    ['Analysis duration', `${(result.durationMs / 1000).toFixed(1)} seconds`],
  ]);

  heading('Executive Summary');
  body(
    `The uploaded policy scored ${result.score} out of 100 against the Digital Personal Data Protection Act, 2023, and is assessed as ${result.verdict}. ` +
      `Of ${result.totals.checked} applicable clause categories, ${result.totals.compliant} were satisfied, ${result.totals.partial} were partially satisfied, ` +
      `${result.totals.nonCompliant} were inadequate and ${result.totals.notDetected} were not found at all. ` +
      `The overall residual risk level is ${result.riskLevel.toUpperCase()}.`,
  );

  heading('Compliance Score');
  kv([
    ['Score', `${result.score} / 100`],
    ['Status', result.verdict],
    ['Risk level', result.riskLevel.toUpperCase()],
    [
      'Formula',
      `(${result.totals.earnedWeight.toFixed(1)} / ${result.totals.applicableWeight.toFixed(1)}) x 100 = ${result.score}`,
    ],
  ]);

  heading('Category-wise Scores');
  kv(result.categories.map((c) => [c.label, `${c.score}%`] as [string, string]));

  heading('DPDPA Compliance Matrix');
  for (const f of result.findings) {
    space(46);
    doc.setFont('helvetica', 'bold').setFontSize(9.5).setTextColor(15, 26, 45);
    doc.text(`${f.requirement.code} — ${f.requirement.title}`, margin, y);
    y += 13;
    doc.setFont('helvetica', 'normal').setFontSize(8.5).setTextColor(90, 105, 130);
    doc.text(
      `Status: ${STATUS_TEXT[f.status]}   |   Confidence: ${Math.round(f.confidence * 100)}%   |   Risk: ${f.risk.toUpperCase()}   |   Weight: ${f.weight}`,
      margin,
      y,
    );
    y += 12;
    doc.setFontSize(8.5).setTextColor(52, 66, 88);
    for (const line of doc.splitTextToSize(f.issue, width - margin * 2)) {
      space(12);
      doc.text(line, margin, y);
      y += 11;
    }
    y += 6;
  }

  // ── Findings & recommendations ──────────────────────────────────────────
  const gaps = result.findings.filter((f) => f.status !== 'compliant' && f.status !== 'not_applicable');
  if (gaps.length) {
    nextPage();
    heading('Critical Findings & Recommendations');
    for (const f of gaps) {
      space(60);
      doc.setFont('helvetica', 'bold').setFontSize(10).setTextColor(15, 26, 45);
      doc.text(`${f.requirement.title} — ${f.risk.toUpperCase()} RISK`, margin, y);
      y += 14;
      body(`Issue: ${f.issue}`, 8.5);
      body(`Why it matters: ${f.requirement.whyItMatters}`, 8.5);
      body(`Recommended action: ${f.requirement.recommendation}`, 8.5);
      body(`Suggested language: ${f.requirement.suggestedLanguage}`, 8.5);
    }
  }

  heading('Final Compliance Status');
  body(
    `${result.verdict} — ${result.score}/100. This assessment covers ${result.totals.checked} applicable DPDPA clause categories; ` +
      `${result.totals.notApplicable} conditional categories were not triggered by this document and are excluded from the score.`,
  );

  heading('Disclaimer', 11);
  body(
    'This report is an automated preliminary assessment generated by DPDPA Sentinel using rule-based clause matching and keyword/NLP analysis. ' +
      'It is not a legal opinion and does not replace review by a qualified legal professional. Ambiguous clauses are deliberately flagged rather than passed. ' +
      'Verify every finding against the matched source text before acting on it.',
    8.5,
  );

  // Page numbers
  const pages = doc.getNumberOfPages();
  for (let i = 1; i <= pages; i += 1) {
    doc.setPage(i);
    doc.setFont('helvetica', 'normal').setFontSize(7.5).setTextColor(140, 155, 175);
    doc.text(
      `DPDPA Sentinel · ${result.stats.fileName} · Page ${i} of ${pages}`,
      width / 2,
      doc.internal.pageSize.getHeight() - 26,
      { align: 'center' },
    );
  }

  doc.save(`DPDPA-Report-${result.stats.fileName.replace(/\.[^.]+$/, '')}-${result.id}.pdf`);
}

/** Machine-readable export for submission alongside the PDF. */
export function downloadReportJson(result: ScanResult): void {
  const payload = {
    reportId: result.id,
    generatedAt: result.createdAt,
    tool: 'DPDPA Sentinel v1.0',
    document: result.stats,
    score: result.score,
    verdict: result.verdict,
    riskLevel: result.riskLevel,
    totals: result.totals,
    categories: result.categories,
    findings: result.findings.map((f) => ({
      id: f.requirement.id,
      code: f.requirement.code,
      title: f.requirement.title,
      section: f.requirement.section,
      weightClass: f.requirement.weightClass,
      weight: f.weight,
      status: f.status,
      confidence: Number(f.confidence.toFixed(3)),
      credit: f.credit,
      risk: f.risk,
      issue: f.issue,
      matchedSpecifics: f.matchedSpecifics,
      missingSpecifics: f.missingSpecifics,
      evidence: f.evidence,
      recommendation: f.requirement.recommendation,
    })),
    concepts: result.concepts,
    disclaimer:
      'Automated preliminary assessment. Not a legal opinion and not a substitute for professional legal advice.',
  };

  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `DPDPA-Report-${result.id}.json`;
  a.click();
  URL.revokeObjectURL(url);
}
