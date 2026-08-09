import * as pdfjs from 'pdfjs-dist';
import workerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';

pdfjs.GlobalWorkerOptions.workerSrc = workerUrl;

export const MAX_FILE_BYTES = 10 * 1024 * 1024; // 10 MB
export const ACCEPTED_EXTENSIONS = ['.pdf', '.docx', '.txt', '.md'];

/** Below this, extraction succeeded technically but there is nothing to analyse. */
const MIN_USEFUL_CHARS = 400;

export type ExtractionErrorCode =
  | 'file_too_large'
  | 'unsupported_type'
  | 'empty_file'
  | 'extraction_failed'
  | 'too_little_text';

export class ExtractionError extends Error {
  code: ExtractionErrorCode;
  hint: string;

  constructor(code: ExtractionErrorCode, message: string, hint: string) {
    super(message);
    this.name = 'ExtractionError';
    this.code = code;
    this.hint = hint;
  }
}

export interface ExtractionResult {
  text: string;
  pages: number;
  /** Share of pages/blocks that yielded usable text, 0..1. */
  extractionRate: number;
  kind: 'pdf' | 'docx' | 'text';
}

function extensionOf(name: string): string {
  const dot = name.lastIndexOf('.');
  return dot === -1 ? '' : name.slice(dot).toLowerCase();
}

export function validateFile(file: File): void {
  if (file.size === 0) {
    throw new ExtractionError(
      'empty_file',
      'This file is empty.',
      'The selected file contains 0 bytes. Pick the actual privacy policy document and try again.',
    );
  }

  if (file.size > MAX_FILE_BYTES) {
    throw new ExtractionError(
      'file_too_large',
      'File exceeds the 10 MB limit.',
      'Compress the PDF or export a text-only version, then upload again.',
    );
  }

  const ext = extensionOf(file.name);
  if (!ACCEPTED_EXTENSIONS.includes(ext)) {
    throw new ExtractionError(
      'unsupported_type',
      `"${ext || 'This format'}" is not supported.`,
      'Supported formats are PDF, DOCX and TXT. Convert the document and retry.',
    );
  }
}

async function extractPdf(file: File): Promise<ExtractionResult> {
  const buffer = await file.arrayBuffer();
  const doc = await pdfjs.getDocument({ data: buffer }).promise;

  const chunks: string[] = [];
  let pagesWithText = 0;

  for (let pageNo = 1; pageNo <= doc.numPages; pageNo += 1) {
    const page = await doc.getPage(pageNo);
    const content = await page.getTextContent();

    // Rebuild line structure from item positions so heading detection still works.
    let pageText = '';
    let lastY: number | null = null;
    for (const item of content.items) {
      if (!('str' in item)) continue;
      const y = Math.round((item.transform?.[5] ?? 0) * 10) / 10;
      if (lastY !== null && Math.abs(y - lastY) > 2) pageText += '\n';
      pageText += item.str;
      if ('hasEOL' in item && item.hasEOL) pageText += '\n';
      lastY = y;
    }

    pageText = pageText.replace(/[ \t]+/g, ' ').trim();
    if (pageText.length > 20) pagesWithText += 1;
    chunks.push(pageText);
  }

  const text = chunks.join('\n\n');
  if (text.trim().length < MIN_USEFUL_CHARS) {
    throw new ExtractionError(
      'too_little_text',
      'Almost no machine-readable text in this PDF.',
      'The PDF looks like a scan or image export. Run it through OCR, or upload the DOCX/TXT source instead.',
    );
  }

  return {
    text,
    pages: doc.numPages,
    extractionRate: doc.numPages ? pagesWithText / doc.numPages : 0,
    kind: 'pdf',
  };
}

async function extractDocx(file: File): Promise<ExtractionResult> {
  const mammoth = await import('mammoth/mammoth.browser');
  const buffer = await file.arrayBuffer();
  const { value } = await mammoth.extractRawText({ arrayBuffer: buffer });
  const text = value.replace(/\r\n/g, '\n').trim();

  if (text.length < MIN_USEFUL_CHARS) {
    throw new ExtractionError(
      'too_little_text',
      'This DOCX contains too little text to analyse.',
      'The document may hold only images or tables. Upload a version with the policy text as text.',
    );
  }

  return {
    text,
    // DOCX has no fixed pagination; approximate at ~500 words per page for the report.
    pages: Math.max(1, Math.ceil(text.split(/\s+/).length / 500)),
    extractionRate: 1,
    kind: 'docx',
  };
}

async function extractPlainText(file: File): Promise<ExtractionResult> {
  const text = (await file.text()).replace(/\r\n/g, '\n').trim();

  if (text.length < MIN_USEFUL_CHARS) {
    throw new ExtractionError(
      'too_little_text',
      'This file has too little text to analyse.',
      `A meaningful privacy policy needs at least ${MIN_USEFUL_CHARS} characters. This one has ${text.length}.`,
    );
  }

  return {
    text,
    pages: Math.max(1, Math.ceil(text.split(/\s+/).length / 500)),
    extractionRate: 1,
    kind: 'text',
  };
}

export async function extractText(file: File): Promise<ExtractionResult> {
  validateFile(file);
  const ext = extensionOf(file.name);

  try {
    if (ext === '.pdf') return await extractPdf(file);
    if (ext === '.docx') return await extractDocx(file);
    return await extractPlainText(file);
  } catch (error) {
    if (error instanceof ExtractionError) throw error;
    throw new ExtractionError(
      'extraction_failed',
      'Text extraction failed.',
      error instanceof Error
        ? `${error.message}. The file may be encrypted, password-protected or corrupted.`
        : 'The file may be encrypted, password-protected or corrupted.',
    );
  }
}
