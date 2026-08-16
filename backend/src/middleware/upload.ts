/**
 * Secure file upload.
 *
 * Files are held in memory, never written under a client-supplied name, and
 * never executed. The uploaded filename is treated as hostile: it is used only
 * for display after sanitisation, and any file actually written to disk gets a
 * cryptographically random name inside a directory that is verified to be
 * contained within the configured upload root.
 */

import { randomUUID } from 'node:crypto';
import path from 'node:path';
import multer from 'multer';
import { env } from '../config/env.js';
import { AppError } from '../utils/errors.js';

export const ACCEPTED_EXTENSIONS = ['.pdf', '.docx', '.txt', '.md'] as const;

const ACCEPTED_MIME = new Set([
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'text/plain',
  'text/markdown',
  'application/octet-stream', // some browsers send this for .docx / .md
]);

export function extensionOf(name: string): string {
  const base = path.basename(name);
  const dot = base.lastIndexOf('.');
  return dot === -1 ? '' : base.slice(dot).toLowerCase();
}

/**
 * Strips directory components and anything that could escape a path or confuse
 * a shell / content-disposition header. Never trust the uploaded name.
 */
export function safeDisplayName(name: string): string {
  const base = path.basename(name.replace(/\\/g, '/'));
  const cleaned = base
    // Control characters first — they can break Content-Disposition headers.
    // eslint-disable-next-line no-control-regex
    .replace(/[\u0000-\u001F\u007F]/g, '')
    .replace(/[^\w.\- ]+/g, '_')
    .replace(/\.{2,}/g, '.')
    .trim();
  const trimmed = cleaned.slice(0, 120);
  return trimmed.length > 0 ? trimmed : 'uploaded-document';
}

/** Random on-disk name; the original never touches the filesystem. */
export function generateStoredName(ext: string): string {
  const safeExt = (ACCEPTED_EXTENSIONS as readonly string[]).includes(ext) ? ext : '.bin';
  return `${Date.now()}-${randomUUID()}${safeExt}`;
}

/**
 * Resolves `child` under `root` and refuses anything that escapes it.
 * Defends against path traversal even if a caller passes a crafted name.
 */
export function resolveWithin(root: string, child: string): string {
  const absRoot = path.resolve(root);
  const resolved = path.resolve(absRoot, child);
  const rel = path.relative(absRoot, resolved);
  if (rel.startsWith('..') || path.isAbsolute(rel)) {
    throw AppError.forbidden('Resolved path escapes its permitted directory.');
  }
  return resolved;
}

export const uploadPolicyDocument = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: env.UPLOAD_MAX_SIZE,
    files: 1,
    fields: 8,
  },
  fileFilter: (_req, file, cb) => {
    const ext = extensionOf(file.originalname);
    if (!(ACCEPTED_EXTENSIONS as readonly string[]).includes(ext)) {
      cb(
        AppError.badRequest(
          'unsupported_type',
          `"${ext || 'This format'}" is not supported.`,
          'Supported formats are PDF, DOCX, TXT and MD. Convert the document and try again.',
        ),
      );
      return;
    }
    if (file.mimetype && !ACCEPTED_MIME.has(file.mimetype)) {
      cb(
        AppError.badRequest(
          'unsupported_type',
          'The file type reported by your browser is not supported.',
          'Upload the policy as a PDF, DOCX, TXT or MD file.',
        ),
      );
      return;
    }
    cb(null, true);
  },
}).single('file');

/** Translates multer's own errors into AppErrors with usable hints. */
export function normalizeUploadError(err: unknown): unknown {
  if (err instanceof multer.MulterError) {
    if (err.code === 'LIMIT_FILE_SIZE') {
      const mb = Math.round(env.UPLOAD_MAX_SIZE / (1024 * 1024));
      return AppError.badRequest(
        'payload_too_large',
        `File exceeds the ${mb} MB limit.`,
        'Compress the PDF or export a text-only version, then upload again.',
      );
    }
    if (err.code === 'LIMIT_FILE_COUNT' || err.code === 'LIMIT_UNEXPECTED_FILE') {
      return AppError.badRequest(
        'validation_failed',
        'Upload exactly one file in the "file" field.',
        'Select a single privacy policy document.',
      );
    }
    return AppError.badRequest('validation_failed', 'The upload could not be processed.');
  }
  return err;
}
