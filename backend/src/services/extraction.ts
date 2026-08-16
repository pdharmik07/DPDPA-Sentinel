/**
 * Document text extraction.
 *
 * Uploaded bytes are validated by content, not by the name or the MIME type the
 * browser claimed, before any parser touches them. Nothing is ever executed;
 * PDFs are parsed with JavaScript disabled and no external resource loading.
 */

import { fileTypeFromBuffer } from 'file-type';
import mammoth from 'mammoth';
import { ExtractionError } from '../utils/errors.js';
import { extensionOf } from '../middleware/upload.js';

/** Below this, extraction technically succeeded but there is nothing to assess. */
export const MIN_USEFUL_CHARS = 400;

export type DocumentKind = 'pdf' | 'docx' | 'text';

export interface ExtractionResult {
  text: string;
  pages: number;
  /** Share of pages that yielded usable text, 0..1. */
  extractionRate: number;
  kind: DocumentKind;
}

/**
 * Content-based type check. A .txt file whose bytes are a PE executable, or a
 * .pdf that is really a zip, is rejected here regardless of what it is named.
 */
async function detectKind(buffer: Buffer, filename: string): Promise<DocumentKind> {
  const ext = extensionOf(filename);
  const sniffed = await fileTypeFromBuffer(buffer);

  if (ext === '.pdf') {
    if (sniffed?.mime !== 'application/pdf') {
      throw new ExtractionError(
        'unsupported_type',
        'This file is named .pdf but its contents are not a PDF.',
        'Re-export the document as a genuine PDF and upload it again.',
      );
    }
    return 'pdf';
  }

  if (ext === '.docx') {
    // DOCX is a zip container; file-type reports zip or the docx mime.
    const ok =
      sniffed?.mime === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
      sniffed?.mime === 'application/zip';
    if (!ok) {
      throw new ExtractionError(
        'unsupported_type',
        'This file is named .docx but its contents are not a Word document.',
        'Re-save the document as .docx from Word or Google Docs and try again.',
      );
    }
    return 'docx';
  }

  // .txt / .md — file-type returns undefined for plain text, which is expected.
  // Anything it *does* recognise as a binary format is rejected.
  if (sniffed && !sniffed.mime.startsWith('text/')) {
    throw new ExtractionError(
      'unsupported_type',
      'This file is named as text but contains binary data.',
      'Upload a genuine plain-text or Markdown file.',
    );
  }
  return 'text';
}

async function extractPdf(buffer: Buffer): Promise<ExtractionResult> {
  // The legacy build is the one that runs under Node without a DOM.
  const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs');

  const doc = await pdfjs.getDocument({
    data: new Uint8Array(buffer),
    // Hardening: never run embedded JS, never fetch anything external.
    isEvalSupported: false,
    disableFontFace: true,
    useSystemFonts: false,
  }).promise;

  const chunks: string[] = [];
  let pagesWithText = 0;

  try {
    for (let pageNo = 1; pageNo <= doc.numPages; pageNo += 1) {
      const page = await doc.getPage(pageNo);
      const content = await page.getTextContent();

      // Rebuild line structure from item positions so heading detection works.
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
      page.cleanup();
    }
  } finally {
    await doc.destroy();
  }

  const text = chunks.join('\n\n');
  if (text.trim().length < MIN_USEFUL_CHARS) {
    throw new ExtractionError(
      'too_little_text',
      'Almost no machine-readable text was found in this PDF.',
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

async function extractDocx(buffer: Buffer): Promise<ExtractionResult> {
  const { value } = await mammoth.extractRawText({ buffer });
  const text = value.replace(/\r\n/g, '\n').trim();

  if (text.length < MIN_USEFUL_CHARS) {
    throw new ExtractionError(
      'too_little_text',
      'This DOCX contains too little text to assess.',
      'The document may hold only images or tables. Upload a version with the policy text as text.',
    );
  }

  return {
    text,
    // DOCX has no fixed pagination; approximate at ~500 words per page.
    pages: Math.max(1, Math.ceil(text.split(/\s+/).length / 500)),
    extractionRate: 1,
    kind: 'docx',
  };
}

function extractPlainText(buffer: Buffer): ExtractionResult {
  const text = buffer.toString('utf8').replace(/\r\n/g, '\n').trim();

  if (text.length < MIN_USEFUL_CHARS) {
    throw new ExtractionError(
      'too_little_text',
      'This file has too little text to assess.',
      `A meaningful privacy policy needs at least ${MIN_USEFUL_CHARS} characters; this one has ${text.length}.`,
    );
  }

  return {
    text,
    pages: Math.max(1, Math.ceil(text.split(/\s+/).length / 500)),
    extractionRate: 1,
    kind: 'text',
  };
}

export async function extractText(buffer: Buffer, filename: string): Promise<ExtractionResult> {
  if (buffer.length === 0) {
    throw new ExtractionError(
      'empty_file',
      'This file is empty.',
      'The selected file contains 0 bytes. Pick the actual policy document and try again.',
    );
  }

  const kind = await detectKind(buffer, filename);

  try {
    if (kind === 'pdf') return await extractPdf(buffer);
    if (kind === 'docx') return await extractDocx(buffer);
    return extractPlainText(buffer);
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
