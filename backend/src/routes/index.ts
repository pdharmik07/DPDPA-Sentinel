/**
 * API surface.
 *
 *   POST   /api/auth/register
 *   POST   /api/auth/login
 *   GET    /api/auth/me
 *
 *   POST   /api/scans                  multipart upload -> 202
 *   GET    /api/scans
 *   GET    /api/scans/:id
 *   GET    /api/scans/:id/status       polled to drive the progress UI
 *   DELETE /api/scans/:id
 *   POST   /api/scans/:id/analyze      re-run analysis
 *   GET    /api/scans/:id/findings
 *   GET    /api/scans/:id/score
 *   GET    /api/scans/:id/report       JSON preview (inline)
 *   GET    /api/scans/:id/report/json  JSON download
 *   GET    /api/scans/:id/report/pdf   PDF download
 *
 *   GET    /api/rules                  public reference data
 *   GET    /api/rules/:id
 *   GET    /api/framework
 *   GET    /api/health
 */

import { Router, type NextFunction, type Request, type Response } from 'express';
import rateLimit from 'express-rate-limit';
import * as authController from '../controllers/authController.js';
import * as reportController from '../controllers/reportController.js';
import * as ruleController from '../controllers/ruleController.js';
import * as scanController from '../controllers/scanController.js';
import { requireAuth, validate } from '../middleware/index.js';
import { normalizeUploadError, uploadPolicyDocument } from '../middleware/upload.js';
import { analysisQueue } from '../services/scanService.js';
import { nlpHealthy } from '../services/nlpClient.js';
import { checkDatabase } from '../services/dbHealth.js';
import { loadRulePack } from '../engine/rulePack.js';

/** Credential endpoints get a much tighter budget than ordinary reads. */
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 20,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: { error: 'Too many attempts. Try again later.', code: 'rate_limited' },
});

/** Uploads are the most expensive endpoint, so they are limited separately. */
const uploadLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 40,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: { error: 'Too many uploads. Try again later.', code: 'rate_limited' },
});

/** Multer must run inside the error pipeline so its errors become AppErrors. */
function upload(req: Request, res: Response, next: NextFunction): void {
  uploadPolicyDocument(req, res, (err: unknown) => {
    if (err) next(normalizeUploadError(err));
    else next();
  });
}

export const router = Router();

// ── Health ──────────────────────────────────────────────────────────────────
router.get('/health', async (_req, res) => {
  const pack = loadRulePack();
  const [db, nlpUp] = await Promise.all([checkDatabase(), nlpHealthy()]);

  // A process that is alive but has no database is not healthy. Reporting 200
  // here would defeat the point of the endpoint.
  res.status(db.status === 'up' ? 200 : 503).json({
    status: db.status === 'up' ? 'ok' : 'degraded',
    service: 'dpdpa-sentinel-backend',
    database: db.status,
    databaseLatencyMs: db.latencyMs,
    ...(db.error ? { databaseError: db.error } : {}),
    ruleVersion: pack.manifest.ruleVersion,
    rules: pack.rules.length,
    nlp: nlpUp ? 'available' : 'unavailable',
    queue: { pending: analysisQueue.size, running: analysisQueue.running },
  });
});

// ── Auth ────────────────────────────────────────────────────────────────────
router.post('/auth/register', authLimiter, validate(authController.registerSchema), authController.register);
router.post('/auth/login', authLimiter, validate(authController.loginSchema), authController.login);
router.get('/auth/me', requireAuth, authController.me);

// ── Rules (public reference data) ───────────────────────────────────────────
router.get('/rules', ruleController.listRules);
router.get('/rules/:id', ruleController.getRule);
router.get('/framework', ruleController.getFramework);

// ── Scans (all owner-scoped) ────────────────────────────────────────────────
router.post('/scans', requireAuth, uploadLimiter, upload, scanController.create);
router.get('/scans', requireAuth, scanController.list);
router.get('/scans/:id', requireAuth, scanController.detail);
router.get('/scans/:id/status', requireAuth, scanController.status);
router.delete('/scans/:id', requireAuth, scanController.remove);
router.post('/scans/:id/analyze', requireAuth, scanController.analyze);
router.get('/scans/:id/findings', requireAuth, scanController.findings);
router.get('/scans/:id/score', requireAuth, scanController.score);

// ── Reports ─────────────────────────────────────────────────────────────────
router.get('/scans/:id/report', requireAuth, reportController.preview);
router.get('/scans/:id/report/json', requireAuth, reportController.json);
router.get('/scans/:id/report/pdf', requireAuth, reportController.pdf);
