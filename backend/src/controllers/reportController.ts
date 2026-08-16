/**
 * Report download endpoints.
 *
 * Ownership is checked inside the service before anything is generated, and the
 * PDF is streamed from a server-side path that the client never sees.
 */

import { createReadStream } from 'node:fs';
import type { Request, Response } from 'express';
import { buildJsonReport, generatePdfReport, recordReport } from '../services/reportService.js';
import { AppError } from '../utils/errors.js';

function userId(req: Request): string {
  if (!req.user) throw AppError.unauthorized();
  return req.user.id;
}

/** Slug used for the download filename; never derived from user input directly. */
function downloadName(scanId: string, ext: string): string {
  return `dpdpa-sentinel-report-${scanId}.${ext}`;
}

export async function json(req: Request, res: Response): Promise<void> {
  const scanId = String(req.params.id);
  const report = await buildJsonReport(scanId, userId(req));
  await recordReport(scanId, 'JSON');

  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="${downloadName(scanId, 'json')}"`);
  res.send(JSON.stringify(report, null, 2));
}

/** Same payload, but rendered inline rather than as a download. */
export async function preview(req: Request, res: Response): Promise<void> {
  res.json(await buildJsonReport(String(req.params.id), userId(req)));
}

export async function pdf(req: Request, res: Response): Promise<void> {
  const scanId = String(req.params.id);
  const info = await generatePdfReport(scanId, userId(req));
  await recordReport(scanId, 'PDF', info);

  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Length', String(info.fileSize));
  res.setHeader('Content-Disposition', `attachment; filename="${downloadName(scanId, 'pdf')}"`);
  res.setHeader('X-Checksum-SHA256', info.checksum);

  const stream = createReadStream(info.filePath);
  stream.on('error', () => {
    if (!res.headersSent) res.status(500).json({ error: 'Report could not be read.', code: 'internal_error' });
    else res.end();
  });
  stream.pipe(res);
}
