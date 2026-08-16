/**
 * Database reachability probe.
 *
 * The health endpoint used to report "ok" purely because the process was alive,
 * which meant it happily returned 200 while PostgreSQL was gone entirely — the
 * one situation a health check exists to catch. It now actually asks the
 * database, with a short timeout so a dead or unreachable server produces a
 * fast answer instead of hanging on the connection pool.
 */

import { prisma } from '../config/prisma.js';

const PROBE_TIMEOUT_MS = 2500;

export type DbStatus = 'up' | 'down';

export async function checkDatabase(): Promise<{ status: DbStatus; latencyMs: number | null; error?: string }> {
  const started = Date.now();

  try {
    await Promise.race([
      prisma.$queryRaw`SELECT 1`,
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error(`database did not respond within ${PROBE_TIMEOUT_MS}ms`)), PROBE_TIMEOUT_MS),
      ),
    ]);
    return { status: 'up', latencyMs: Date.now() - started };
  } catch (error) {
    return {
      status: 'down',
      latencyMs: null,
      // Safe to surface: this endpoint is operational, and it says nothing
      // about credentials or schema.
      error: error instanceof Error ? error.message.split('\n')[0] : 'unknown error',
    };
  }
}

/**
 * Recognises the driver-level failures that mean "the database is unreachable"
 * as opposed to "your query was wrong", so the API can answer 503 rather than a
 * generic 500.
 */
export function isConnectivityError(error: unknown): boolean {
  const code = (error as { code?: string } | null)?.code;
  // Prisma: P1001 unreachable, P1002 timed out, P1008 operation timeout,
  // P1017 server closed the connection.
  if (code && ['P1001', 'P1002', 'P1008', 'P1017'].includes(code)) return true;

  const message = error instanceof Error ? error.message : String(error ?? '');
  return /ECONNREFUSED|ECONNRESET|forcibly closed|Connection terminated|connection closed|Can't reach database server/i.test(
    message,
  );
}
