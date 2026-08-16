/**
 * End-to-end API tests against a real PostgreSQL instance.
 *
 * Uses embedded-postgres rather than Docker so the suite runs anywhere — the
 * reference machine for this project cannot run Docker Desktop (Windows Home
 * without WSL2), and an integration suite that only works on some machines is
 * not much of an integration suite.
 *
 * Covers the whole user journey plus the authorization boundary.
 */

import { execSync } from 'node:child_process';
import { readFileSync, rmSync } from 'node:fs';
import path from 'node:path';
import EmbeddedPostgres from 'embedded-postgres';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { Express } from 'express';

const PORT = 55433;
const DATABASE_URL = `postgresql://dpdpa:dpdpa@localhost:${PORT}/dpdpa_sentinel?schema=public`;
const DATA_DIR = path.resolve(process.cwd(), '.pgdata-test');
const SAMPLES = path.resolve(__dirname, '../../samples');

let pg: EmbeddedPostgres;
let app: Express;
let disconnect: () => Promise<void>;
let queueIdle: () => Promise<void>;

const ALICE = { name: 'Alice Analyst', email: 'alice@example.com', password: 'correct-horse-battery' };
const MALLORY = { name: 'Mallory Other', email: 'mallory@example.com', password: 'another-long-password' };

beforeAll(async () => {
  rmSync(DATA_DIR, { recursive: true, force: true });

  pg = new EmbeddedPostgres({
    databaseDir: DATA_DIR,
    user: 'dpdpa',
    password: 'dpdpa',
    port: PORT,
    persistent: false,
    // Without this, initdb inherits the Windows locale and builds a WIN1252
    // cluster that cannot store the em-dashes and arrows in the rule pack.
    // postgres:16-alpine (docker-compose) is UTF8, so this matches production.
    initdbFlags: ['--encoding=UTF8', '--locale=C'],
    onLog: () => {},
  });
  await pg.initialise();
  await pg.start();
  await pg.createDatabase('dpdpa_sentinel');

  // The env module reads process.env at import time, so it must be set first.
  process.env.DATABASE_URL = DATABASE_URL;
  process.env.NODE_ENV = 'test';
  process.env.NLP_ENABLED = 'false'; // exercise the degraded path deliberately
  process.env.LOG_LEVEL = 'error';

  const env = { ...process.env, DATABASE_URL };
  execSync('npx prisma migrate deploy', { env, stdio: 'pipe' });
  execSync('npx tsx prisma/seed.ts', { env, stdio: 'pipe' });

  const [{ createApp }, prismaModule, scanModule] = await Promise.all([
    import('../src/app.js'),
    import('../src/config/prisma.js'),
    import('../src/services/scanService.js'),
  ]);
  app = createApp();
  disconnect = prismaModule.disconnectPrisma;
  queueIdle = () => scanModule.analysisQueue.idle();
}, 300_000);

afterAll(async () => {
  // A re-queued analysis can still be in flight; draining first avoids tearing
  // the Prisma client out from under a running job.
  await queueIdle?.();
  await disconnect?.();
  await pg?.stop();
  rmSync(DATA_DIR, { recursive: true, force: true });
}, 60_000);

async function tokenFor(user: typeof ALICE): Promise<string> {
  const res = await request(app).post('/api/auth/register').send(user);
  if (res.status === 201) return res.body.token as string;
  const login = await request(app).post('/api/auth/login').send({ email: user.email, password: user.password });
  return login.body.token as string;
}

/** Uploads a policy and waits for the analysis to finish. */
async function runScan(token: string, file: string): Promise<string> {
  const buffer = readFileSync(path.join(SAMPLES, file));
  const created = await request(app)
    .post('/api/scans')
    .set('Authorization', `Bearer ${token}`)
    .attach('file', buffer, file);

  expect(created.status).toBe(202);
  const scanId = created.body.scan.id as string;

  for (let i = 0; i < 120; i += 1) {
    const status = await request(app).get(`/api/scans/${scanId}/status`).set('Authorization', `Bearer ${token}`);
    if (status.body.status === 'COMPLETED') return scanId;
    if (status.body.status === 'FAILED') throw new Error(`analysis failed: ${status.body.error}`);
    await new Promise((r) => setTimeout(r, 250));
  }
  throw new Error('analysis did not complete in time');
}

// ── Health and reference data ───────────────────────────────────────────────

describe('public endpoints', () => {
  it('reports health with the loaded rule pack and a live database', async () => {
    const res = await request(app).get('/api/health');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ok');
    expect(res.body.rules).toBe(41);
    // Health must actually prove the database is reachable. It previously
    // reported "ok" with PostgreSQL entirely absent, which defeats the point.
    expect(res.body.database).toBe('up');
    expect(typeof res.body.databaseLatencyMs).toBe('number');
  });

  it('serves the framework and rules without authentication', async () => {
    const framework = await request(app).get('/api/framework');
    expect(framework.status).toBe(200);
    expect(framework.body.categories).toHaveLength(16);
    expect(framework.body.totals.rules).toBe(41);

    const rules = await request(app).get('/api/rules');
    expect(rules.status).toBe(200);
    expect(rules.body.rules).toHaveLength(41);
  });

  it('never exposes detection regex to clients', async () => {
    const res = await request(app).get('/api/rules/C4');
    expect(res.status).toBe(200);

    // Publishing the patterns would let a policy be written to game the scanner
    // rather than to comply. Only counts and human-readable labels are exposed.
    const summary = res.body.rule.detectionSummary;
    expect(typeof summary.anchors).toBe('number');
    expect(typeof summary.supporting).toBe('number');
    expect(summary.specifics.length).toBeGreaterThan(0);

    // No regex source anywhere in the payload.
    const serialised = JSON.stringify(res.body);
    for (const token of ['\\b', '(?:', '(?=', '[^.]', '\\s+', '\\w*']) {
      expect(serialised, `leaked regex token ${token}`).not.toContain(token);
    }
  });

  it('surfaces commencement status per rule', async () => {
    const res = await request(app).get('/api/rules/B2');
    expect(['IN_FORCE', 'NOT_YET_IN_FORCE', 'UNKNOWN']).toContain(res.body.rule.effectiveStatus);
  });
});

// ── Auth ────────────────────────────────────────────────────────────────────

describe('authentication', () => {
  it('registers, logs in and returns the current user', async () => {
    const registered = await request(app).post('/api/auth/register').send(ALICE);
    expect(registered.status).toBe(201);
    expect(registered.body.token).toBeTruthy();
    // A password hash must never leave the server.
    expect(JSON.stringify(registered.body)).not.toContain('passwordHash');

    const login = await request(app)
      .post('/api/auth/login')
      .send({ email: ALICE.email, password: ALICE.password });
    expect(login.status).toBe(200);

    const me = await request(app).get('/api/auth/me').set('Authorization', `Bearer ${login.body.token}`);
    expect(me.status).toBe(200);
    expect(me.body.user.email).toBe(ALICE.email);
  });

  it('rejects a duplicate email', async () => {
    const res = await request(app).post('/api/auth/register').send(ALICE);
    expect(res.status).toBe(409);
    expect(res.body.code).toBe('email_taken');
  });

  it('rejects a weak password with field-level detail', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({ name: 'Bob', email: 'bob@example.com', password: 'short' });
    expect(res.status).toBe(400);
    expect(res.body.code).toBe('validation_failed');
    expect(res.body.details.some((d: { field: string }) => d.field === 'password')).toBe(true);
  });

  it('gives an identical response for a wrong password and an unknown account', async () => {
    const wrongPassword = await request(app)
      .post('/api/auth/login')
      .send({ email: ALICE.email, password: 'definitely-not-it' });
    const unknownUser = await request(app)
      .post('/api/auth/login')
      .send({ email: 'nobody@example.com', password: 'definitely-not-it' });

    expect(wrongPassword.status).toBe(401);
    expect(unknownUser.status).toBe(401);
    // Identical wording, so the endpoint cannot be used to enumerate accounts.
    expect(unknownUser.body.error).toBe(wrongPassword.body.error);
    expect(unknownUser.body.code).toBe(wrongPassword.body.code);
  });

  it('refuses protected routes without a valid token', async () => {
    expect((await request(app).get('/api/scans')).status).toBe(401);
    expect((await request(app).get('/api/scans').set('Authorization', 'Bearer nonsense')).status).toBe(401);
  });
});

// ── The full scan journey ───────────────────────────────────────────────────

describe('scan lifecycle', () => {
  let token: string;
  let scanId: string;

  beforeAll(async () => {
    token = await tokenFor(ALICE);
    scanId = await runScan(token, '01-strong-fintech-policy.txt');
  }, 120_000);

  it('completes the analysis and stores a score and a risk assessment', async () => {
    const res = await request(app).get(`/api/scans/${scanId}`).set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.scan.status).toBe('COMPLETED');
    expect(res.body.scan.score.overallScore).toBeGreaterThan(80);
    expect(res.body.scan.score.verdict).toBe('STRONG ALIGNMENT');
    expect(res.body.scan.risk.level).toBe('LOW');
    // NLP was disabled for this run, so the degraded path must be recorded.
    expect(res.body.scan.nlpAvailable).toBe(false);
  });

  it('persists one finding per rule, each with evidence and a legal reference', async () => {
    const res = await request(app).get(`/api/scans/${scanId}/findings`).set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.findings).toHaveLength(41);

    for (const finding of res.body.findings) {
      expect(finding.rule).toBeTruthy();
      expect(finding.reasoning.length).toBeGreaterThan(10);
      if (finding.status === 'PASS') {
        expect(finding.evidence.length, `${finding.ruleId}`).toBeGreaterThan(0);
        expect(finding.legalReference).toBeTruthy();
      }
      if (finding.status === 'NOT_APPLICABLE') {
        expect(finding.applicabilityReason).toBeTruthy();
        expect(finding.points).toBe(0);
      }
    }
  });

  it('returns a score breakdown with auditable risk factors', async () => {
    const res = await request(app).get(`/api/scans/${scanId}/score`).set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.score.scoringModel).toBe('design-doc-1.0');
    expect(res.body.score.categoryScores.length).toBeGreaterThan(5);
    expect(res.body.risk.factors.length).toBeGreaterThan(5);
    expect(res.body.risk.explanation).toBeTruthy();
  });

  it('lists the scan in history', async () => {
    const res = await request(app).get('/api/scans').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.scans.some((s: { id: string }) => s.id === scanId)).toBe(true);
    // Extracted policy text must not be in a list response.
    expect(JSON.stringify(res.body)).not.toContain('extractedText');
  });

  it('generates a JSON report carrying the disclaimer', async () => {
    const res = await request(app)
      .get(`/api/scans/${scanId}/report/json`)
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.headers['content-disposition']).toContain('attachment');

    const report = JSON.parse(res.text);
    expect(report.report.disclaimer).toContain('not a legal opinion');
    expect(report.findings).toHaveLength(41);
    expect(report.framework.scoringModel).toBe('design-doc-1.0');
  });

  it('generates a PDF report', async () => {
    const res = await request(app)
      .get(`/api/scans/${scanId}/report/pdf`)
      .set('Authorization', `Bearer ${token}`)
      .buffer(true)
      .parse((response, callback) => {
        const chunks: Buffer[] = [];
        response.on('data', (c: Buffer) => chunks.push(c));
        response.on('end', () => callback(null, Buffer.concat(chunks)));
      });

    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toBe('application/pdf');
    const body = res.body as Buffer;
    expect(body.subarray(0, 5).toString()).toBe('%PDF-');
    expect(body.length).toBeGreaterThan(5000);
    expect(res.headers['x-checksum-sha256']).toMatch(/^[a-f0-9]{64}$/);
  }, 60_000);

  it('re-runs analysis on demand', async () => {
    const res = await request(app)
      .post(`/api/scans/${scanId}/analyze`)
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(202);
    expect(res.body.status).toBe('QUEUED');
  });
});

// ── Authorization boundary ──────────────────────────────────────────────────

describe('ownership enforcement (IDOR)', () => {
  let aliceToken: string;
  let malloryToken: string;
  let aliceScanId: string;

  beforeAll(async () => {
    aliceToken = await tokenFor(ALICE);
    malloryToken = await tokenFor(MALLORY);
    aliceScanId = await runScan(aliceToken, '02-weak-startup-notice.txt');
  }, 120_000);

  it("hides another user's scan behind a 404 on every scan-scoped route", async () => {
    const routes = [
      `/api/scans/${aliceScanId}`,
      `/api/scans/${aliceScanId}/status`,
      `/api/scans/${aliceScanId}/findings`,
      `/api/scans/${aliceScanId}/score`,
      `/api/scans/${aliceScanId}/report`,
      `/api/scans/${aliceScanId}/report/json`,
      `/api/scans/${aliceScanId}/report/pdf`,
    ];
    for (const route of routes) {
      const res = await request(app).get(route).set('Authorization', `Bearer ${malloryToken}`);
      // 404, not 403: the API must not confirm the id exists.
      expect(res.status, route).toBe(404);
    }
  });

  it("refuses to delete or re-analyse another user's scan", async () => {
    expect(
      (await request(app).delete(`/api/scans/${aliceScanId}`).set('Authorization', `Bearer ${malloryToken}`)).status,
    ).toBe(404);
    expect(
      (await request(app).post(`/api/scans/${aliceScanId}/analyze`).set('Authorization', `Bearer ${malloryToken}`))
        .status,
    ).toBe(404);
  });

  it("keeps another user's scan out of its owner's history listing", async () => {
    const res = await request(app).get('/api/scans').set('Authorization', `Bearer ${malloryToken}`);
    expect(res.body.scans.some((s: { id: string }) => s.id === aliceScanId)).toBe(false);
  });

  it('allows the owner to delete their own scan', async () => {
    const res = await request(app).delete(`/api/scans/${aliceScanId}`).set('Authorization', `Bearer ${aliceToken}`);
    expect(res.status).toBe(204);
    expect(
      (await request(app).get(`/api/scans/${aliceScanId}`).set('Authorization', `Bearer ${aliceToken}`)).status,
    ).toBe(404);
  });
});

// ── Upload validation ───────────────────────────────────────────────────────

describe('upload validation', () => {
  let token: string;
  beforeAll(async () => {
    token = await tokenFor(ALICE);
  });

  it('rejects an unsupported extension', async () => {
    const res = await request(app)
      .post('/api/scans')
      .set('Authorization', `Bearer ${token}`)
      .attach('file', Buffer.from('#!/bin/sh\necho hi'), 'payload.sh');
    expect(res.status).toBe(400);
    expect(res.body.code).toBe('unsupported_type');
  });

  it('rejects a file whose bytes contradict its extension', async () => {
    // A real PDF header inside a file claiming to be plain text.
    const disguised = Buffer.concat([Buffer.from('%PDF-1.7\n'), Buffer.alloc(600, 0x41)]);
    const res = await request(app)
      .post('/api/scans')
      .set('Authorization', `Bearer ${token}`)
      .attach('file', disguised, 'notes.txt');
    expect(res.status).toBe(400);
    expect(res.body.code).toBe('unsupported_type');
  });

  it('rejects a document with too little text to assess', async () => {
    const res = await request(app)
      .post('/api/scans')
      .set('Authorization', `Bearer ${token}`)
      .attach('file', Buffer.from('too short'), 'tiny.txt');
    expect(res.status).toBe(400);
    expect(res.body.code).toBe('too_little_text');
  });

  it('rejects a request with no file', async () => {
    const res = await request(app).post('/api/scans').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(400);
    expect(res.body.code).toBe('validation_failed');
  });

  it('sanitises a traversal-style filename before storing it', async () => {
    const policy = readFileSync(path.join(SAMPLES, '03-medium-edtech-policy.md'));
    const res = await request(app)
      .post('/api/scans')
      .set('Authorization', `Bearer ${token}`)
      .attach('file', policy, '../../../../etc/evil-policy.md');
    expect(res.status).toBe(202);
    expect(res.body.scan.fileName).toBe('evil-policy.md');
  });
});

// ── Error handling ──────────────────────────────────────────────────────────

describe('error handling', () => {
  it('returns a request id and no stack trace on an unknown route', async () => {
    const res = await request(app).get('/api/does-not-exist');
    expect(res.status).toBe(404);
    expect(res.body.requestId).toBeTruthy();
    expect(JSON.stringify(res.body)).not.toContain('at Object');
  });

  it('404s an unknown rule id', async () => {
    const res = await request(app).get('/api/rules/NOPE');
    expect(res.status).toBe(404);
  });
});
