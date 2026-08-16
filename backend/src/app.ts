/**
 * Express application assembly. Kept separate from server.ts so tests can
 * mount the app without binding a port.
 */

import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { pinoHttp } from 'pino-http';
import { allowedOrigins, isTest } from './config/env.js';
import { logger } from './config/logger.js';
import { errorHandler, notFoundHandler, requestId } from './middleware/index.js';
import { router } from './routes/index.js';
import { AppError } from './utils/errors.js';

export function createApp() {
  const app = express();

  // Behind a single reverse proxy in the reference deployment. This must be set
  // for express-rate-limit to key on the real client IP rather than the proxy.
  app.set('trust proxy', 1);
  app.disable('x-powered-by');

  app.use(requestId);

  app.use(
    helmet({
      // The API serves JSON and PDF only; it never renders HTML, so a maximally
      // restrictive CSP is free here.
      contentSecurityPolicy: {
        directives: { defaultSrc: ["'none'"], frameAncestors: ["'none'"], baseUri: ["'none'"] },
      },
      crossOriginResourcePolicy: { policy: 'same-site' },
      referrerPolicy: { policy: 'no-referrer' },
    }),
  );

  app.use(
    cors({
      // Strict allowlist. A request from an unlisted origin is rejected rather
      // than silently echoed back.
      origin(origin, callback) {
        // Same-origin/non-browser callers (curl, health checks) send no Origin.
        if (!origin) return callback(null, true);
        if (allowedOrigins.includes(origin)) return callback(null, true);
        callback(AppError.forbidden(`Origin ${origin} is not allowed.`));
      },
      methods: ['GET', 'POST', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization'],
      exposedHeaders: ['X-Request-Id', 'X-Checksum-SHA256'],
      maxAge: 600,
    }),
  );

  if (!isTest) {
    app.use(
      pinoHttp({
        logger,
        genReqId: (req) => (req as express.Request).id,
        // Health checks would otherwise dominate the log.
        autoLogging: { ignore: (req) => req.url === '/api/health' },
      }),
    );
  }

  app.use(express.json({ limit: '256kb' }));
  app.use(express.urlencoded({ extended: false, limit: '256kb' }));

  // Global ceiling. Per-route limits in the router are tighter where it matters.
  app.use(
    rateLimit({
      windowMs: 60_000,
      limit: 200,
      standardHeaders: 'draft-7',
      legacyHeaders: false,
      message: { error: 'Too many requests. Slow down and try again.', code: 'rate_limited' },
    }),
  );

  app.use('/api', router);

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
