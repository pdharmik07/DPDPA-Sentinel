/**
 * Renders the sample policies to PDF and reports what each should score.
 *
 * The app accepts PDF, DOCX, TXT and MD, but PDF is the format a real user
 * will actually have, and it is the one with a genuine extraction step
 * (pdf.js rebuilding line structure from glyph positions). Testing with PDFs
 * therefore exercises more of the pipeline than a .txt does.
 *
 *   npx tsx scripts/makeSamplePdfs.ts
 */

import { createWriteStream, mkdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import PDFDocument from 'pdfkit';
import { analyzeText } from '../src/engine/analyze.js';

interface Source {
  file: string;
  out: string;
  title: string;
  /** What this document is meant to exercise. */
  exercises: string;
}

const ROOT = path.resolve(process.cwd(), '..');
const OUT_DIR = path.join(ROOT, 'samples', 'pdf');

const SOURCES: Source[] = [
  {
    file: 'samples/01-strong-fintech-policy.txt',
    out: '1-strong-fintech.pdf',
    title: 'PayGrid — Privacy Policy (strong)',
    exercises: 'A well-drafted policy: nearly every requirement satisfied',
  },
  {
    file: 'backend/tests/fixtures/international.txt',
    out: '2-international-sdf.pdf',
    title: 'GlobalSaaS — Privacy Notice (cross-border + SDF)',
    exercises: 'Triggers cross-border transfer AND Significant Data Fiduciary rules',
  },
  {
    file: 'backend/tests/fixtures/children-service.txt',
    out: "3-childrens-service.pdf",
    title: "KidLearn — Privacy Notice (children's data)",
    exercises: "Triggers the children's-data category (verifiable parental consent)",
  },
  {
    file: 'samples/03-medium-edtech-policy.md',
    out: '4-medium-edtech.pdf',
    title: 'EdTech Platform — Privacy Policy (partial)',
    exercises: 'Half-complete policy: many PARTIAL findings',
  },
  {
    file: 'backend/tests/fixtures/ecommerce.txt',
    out: '5-ecommerce-implied-consent.pdf',
    title: 'ShopCart — Privacy Policy (implied consent)',
    exercises: 'Contains "by continuing to use the site you agree" — a direct C2 violation',
  },
  {
    file: 'samples/02-weak-startup-notice.txt',
    out: '6-weak-startup.pdf',
    title: 'Startup — Privacy Notice (very weak)',
    exercises: 'Minimal notice: most requirements absent',
  },
];

function renderPdf(text: string, title: string, target: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: 'A4', margin: 56, info: { Title: title } });
    const stream = createWriteStream(target);
    stream.on('finish', () => resolve());
    stream.on('error', reject);
    doc.pipe(stream);

    doc.font('Helvetica-Bold').fontSize(15).fillColor('#111').text(title);
    doc.moveDown(1);

    // Preserve blank-line paragraph breaks; headings are short ALL-CAPS lines.
    for (const block of text.split(/\n\s*\n/)) {
      const line = block.trim();
      if (!line) continue;
      const isHeading = line.length < 80 && /^[0-9A-Z][A-Z0-9 .&'’()\/-]{2,}$/.test(line.split('\n')[0] ?? '');
      doc
        .font(isHeading ? 'Helvetica-Bold' : 'Helvetica')
        .fontSize(isHeading ? 11 : 10)
        .fillColor('#111')
        .text(line.replace(/\n/g, ' '), { align: 'left', lineGap: 1.5 });
      doc.moveDown(isHeading ? 0.4 : 0.7);
    }

    doc.end();
  });
}

mkdirSync(OUT_DIR, { recursive: true });

const rows: string[][] = [];

for (const source of SOURCES) {
  const text = readFileSync(path.join(ROOT, source.file), 'utf8');
  await renderPdf(text, source.title, path.join(OUT_DIR, source.out));

  // Predict the outcome from the same engine the server runs.
  const result = analyzeText(text);
  const s = result.score;
  rows.push([
    source.out,
    String(s.overallScore),
    s.verdict,
    result.risk.level,
    `${s.passedCount}/${s.partialCount}/${s.failedCount}/${s.notApplicableCount}`,
    source.exercises,
  ]);
}

const header = ['file', 'score', 'verdict', 'risk', 'pass/part/fail/na', 'what it exercises'];
const widths = header.map((h, i) => Math.max(h.length, ...rows.map((r) => (r[i] ?? '').length)));
const line = (cells: string[]) => cells.map((c, i) => c.padEnd(widths[i] ?? 0)).join('  ');

console.log(`\nwrote ${rows.length} PDFs to samples/pdf/\n`);
console.log(line(header));
console.log(widths.map((w) => '-'.repeat(w)).join('  '));
for (const row of rows) console.log(line(row));
console.log('\nNote: scores are from the deterministic engine. With the NLP service running,');
console.log('confidence values shift slightly but PASS/PARTIAL/FAIL outcomes do not.');
