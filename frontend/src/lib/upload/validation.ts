/**
 * Client-side upload pre-validation.
 *
 * This is a UX convenience only — it gives immediate feedback without a round
 * trip. The server re-validates everything authoritatively, including
 * magic-byte content sniffing, which a browser cannot be trusted to do.
 *
 * Deliberately lightweight: the old module also carried in-browser PDF and DOCX
 * extraction, which pulled pdf.js and mammoth (~1.4 MB) into the bundle. Text
 * extraction now happens on the server, so none of that ships to the client.
 * Keep the limits here in step with backend/src/middleware/upload.ts.
 */

export const MAX_FILE_BYTES = 10 * 1024 * 1024; // must match UPLOAD_MAX_SIZE
export const ACCEPTED_EXTENSIONS = ['.pdf', '.docx', '.txt', '.md'] as const;

export type UploadErrorCode = 'empty_file' | 'file_too_large' | 'unsupported_type';

export class UploadValidationError extends Error {
  readonly code: UploadErrorCode;
  readonly hint: string;

  constructor(code: UploadErrorCode, message: string, hint: string) {
    super(message);
    this.name = 'UploadValidationError';
    this.code = code;
    this.hint = hint;
  }
}

function extensionOf(name: string): string {
  const dot = name.lastIndexOf('.');
  return dot === -1 ? '' : name.slice(dot).toLowerCase();
}

export function validateFile(file: File): void {
  if (file.size === 0) {
    throw new UploadValidationError(
      'empty_file',
      'This file is empty.',
      'The selected file contains 0 bytes. Pick the actual privacy policy document and try again.',
    );
  }

  if (file.size > MAX_FILE_BYTES) {
    throw new UploadValidationError(
      'file_too_large',
      'File exceeds the 10 MB limit.',
      'Compress the PDF or export a text-only version, then upload again.',
    );
  }

  const ext = extensionOf(file.name);
  if (!(ACCEPTED_EXTENSIONS as readonly string[]).includes(ext)) {
    throw new UploadValidationError(
      'unsupported_type',
      `"${ext || 'This format'}" is not supported.`,
      'Supported formats are PDF, DOCX, TXT and MD. Convert the document and retry.',
    );
  }
}
