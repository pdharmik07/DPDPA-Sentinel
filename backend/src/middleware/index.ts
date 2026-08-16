/**
 * Express middleware: request identity, authentication, validation and the
 * terminal error handler.
 */

import { randomUUID } from 'node:crypto';
import type { NextFunction, Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import { ZodError, type ZodSchema } from 'zod';
import { env, isProd } from '../config/env.js';
import { logger } from '../config/logger.js';
import { AppError } from '../utils/errors.js';
import { isConnectivityError } from '../services/dbHealth.js';

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      requestId: string;
      user?: { id: string; email: string };
    }
  }
}

// ── Request id ──────────────────────────────────────────────────────────────

export function requestId(req: Request, res: Response, next: NextFunction): void {
  req.requestId = randomUUID();
  res.setHeader('X-Request-Id', req.requestId);
  next();
}

// ── Authentication ──────────────────────────────────────────────────────────

export interface JwtPayload {
  sub: string;
  email: string;
}

export function signToken(payload: JwtPayload): string {
  return jwt.sign(payload, env.JWT_SECRET, {
    expiresIn: env.JWT_EXPIRES_IN,
  } as jwt.SignOptions);
}

/**
 * Requires a valid bearer token. Populates req.user.
 *
 * Note this only establishes *who* the caller is. Whether they may touch a
 * particular scan is a separate check performed in the service layer against
 * the row's userId — see assertScanOwned.
 */
export function requireAuth(req: Request, _res: Response, next: NextFunction): void {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) {
    next(AppError.unauthorized('Authentication required.', 'Sign in and try again.'));
    return;
  }

  const token = header.slice('Bearer '.length).trim();
  try {
    const decoded = jwt.verify(token, env.JWT_SECRET) as JwtPayload;
    if (!decoded?.sub) throw new Error('malformed token');
    req.user = { id: decoded.sub, email: decoded.email };
    next();
  } catch {
    // Deliberately generic: never reveal whether the token was expired,
    // malformed or signed with the wrong key.
    next(AppError.unauthorized('Your session is invalid or has expired.', 'Sign in again to continue.'));
  }
}

// ── Validation ──────────────────────────────────────────────────────────────

type Source = 'body' | 'query' | 'params';

export function validate(schema: ZodSchema, source: Source = 'body') {
  return (req: Request, _res: Response, next: NextFunction): void => {
    const result = schema.safeParse(req[source]);
    if (!result.success) {
      next(
        AppError.badRequest(
          'validation_failed',
          'The request could not be processed.',
          'Check the highlighted fields and try again.',
          flattenZod(result.error),
        ),
      );
      return;
    }
    // Replace with the parsed (and coerced/stripped) value.
    if (source === 'body') req.body = result.data;
    else Object.assign(req[source], result.data);
    next();
  };
}

function flattenZod(error: ZodError): { field: string; message: string }[] {
  return error.issues.map((i) => ({ field: i.path.join('.') || '(root)', message: i.message }));
}

// ── Errors ──────────────────────────────────────────────────────────────────

export function notFoundHandler(req: Request, _res: Response, next: NextFunction): void {
  next(AppError.notFound(`No route matches ${req.method} ${req.path}.`));
}

export function errorHandler(
  err: unknown,
  req: Request,
  res: Response,
  // Express identifies the error handler by arity — the 4th parameter must stay.
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _next: NextFunction,
): void {
  if (err instanceof AppError) {
    // Expected, user-facing. Log at warn without a stack.
    logger.warn({ requestId: req.requestId, code: err.code, status: err.status, userId: req.user?.id }, err.message);
    res.status(err.status).json({
      error: err.message,
      code: err.code,
      ...(err.hint ? { hint: err.hint } : {}),
      ...(err.details ? { details: err.details } : {}),
      requestId: req.requestId,
    });
    return;
  }

  // The database is unreachable. This is an infrastructure fault, not a bug in
  // the request, and it deserves a 503 the client can act on.
  if (isConnectivityError(err)) {
    logger.error({ requestId: req.requestId, userId: req.user?.id }, 'database unreachable');
    res.status(503).json({
      error: 'The service is temporarily unable to reach its database.',
      code: 'internal_error',
      hint: 'Check that PostgreSQL is running, then try again.',
      requestId: req.requestId,
    });
    return;
  }

  // Unexpected. Log everything server-side, reveal nothing client-side.
  logger.error(
    { requestId: req.requestId, userId: req.user?.id, err: err instanceof Error ? err : new Error(String(err)) },
    'unhandled error',
  );

  res.status(500).json({
    error: 'Something went wrong while processing your request.',
    code: 'internal_error',
    hint: 'Try again. If the problem persists, quote the request id below.',
    requestId: req.requestId,
    ...(isProd ? {} : { debug: err instanceof Error ? err.message : String(err) }),
  });
}
