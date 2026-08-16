/**
 * Scan endpoints. Every handler resolves the caller from req.user and passes
 * that id into the service layer, which enforces ownership.
 */

import type { Request, Response } from 'express';
import { z } from 'zod';
import * as scanService from '../services/scanService.js';
import { AppError } from '../utils/errors.js';

export const scanIdSchema = z.object({ id: z.string().min(1).max(64) });

function userId(req: Request): string {
  if (!req.user) throw AppError.unauthorized();
  return req.user.id;
}

export async function create(req: Request, res: Response): Promise<void> {
  if (!req.file) {
    throw AppError.badRequest(
      'validation_failed',
      'No file was uploaded.',
      'Attach a privacy policy as PDF, DOCX, TXT or MD in the "file" field.',
    );
  }

  const scan = await scanService.createScan({
    userId: userId(req),
    buffer: req.file.buffer,
    originalName: req.file.originalname,
    requestId: req.requestId,
  });

  // 202: accepted, analysis runs asynchronously. The client polls the status
  // endpoint to drive the progress UI.
  res.status(202).json({
    scan: {
      id: scan.id,
      fileName: scan.fileName,
      fileType: scan.fileType,
      fileSize: scan.fileSize,
      status: scan.status,
      stage: scan.stage,
      pages: scan.pages,
      words: scan.words,
      sentences: scan.sentences,
      paragraphs: scan.paragraphs,
      extractionRate: scan.extractionRate,
      createdAt: scan.createdAt,
    },
  });
}

export async function list(req: Request, res: Response): Promise<void> {
  res.json({ scans: await scanService.listScans(userId(req)) });
}

export async function detail(req: Request, res: Response): Promise<void> {
  const scan = await scanService.getScanDetail(String(req.params.id), userId(req));
  res.json({ scan });
}

export async function status(req: Request, res: Response): Promise<void> {
  res.json(await scanService.getScanStatus(String(req.params.id), userId(req)));
}

export async function analyze(req: Request, res: Response): Promise<void> {
  const scan = await scanService.requeueAnalysis(String(req.params.id), userId(req), req.requestId);
  res.status(202).json({ id: scan.id, status: scan.status, stage: scan.stage });
}

export async function findings(req: Request, res: Response): Promise<void> {
  res.json({ findings: await scanService.getFindings(String(req.params.id), userId(req)) });
}

export async function score(req: Request, res: Response): Promise<void> {
  res.json(await scanService.getScore(String(req.params.id), userId(req)));
}

export async function remove(req: Request, res: Response): Promise<void> {
  await scanService.deleteScan(String(req.params.id), userId(req));
  res.status(204).send();
}
