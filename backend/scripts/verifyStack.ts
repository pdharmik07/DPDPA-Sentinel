/**
 * Full-stack verification over real HTTP against a real PostgreSQL database.
 *
 * Unlike the supertest suite, this boots the actual server, binds a port and
 * talks to it with fetch — proving the deployed path works, not just the app
 * object. Everything is torn down afterwards.
 *
 *   npx tsx scripts/verifyStack.ts
 */

import { execSync } from 'node:child_process';
import { readFileSync, rmSync } from 'node:fs';
import path from 'node:path';
import EmbeddedPostgres from 'embedded-postgres';

const PG_PORT = 55434;
const API_PORT = 4010;
const DATA_DIR = path.resolve(process.cwd(), '.pgdata-verify');
const DATABASE_URL = `postgresql://dpdpa:dpdpa@localhost:${PG_PORT}/dpdpa_sentinel?schema=public`;
const BASE = `http://127.0.0.1:${API_PORT}`;
const SAMPLES = path.resolve(process.cwd(), '../samples');

let passed = 0;
let failed = 0;

function check(label: string, ok: boolean, detail = ''): void {
  if (ok) {
    passed += 1;
    console.log(`  ✓ ${label}${detail ? `  ${detail}` : ''}`);
  } else {
    failed += 1;
    console.log(`  ✗ ${label}${detail ? `  ${detail}` : ''}`);
  }
}

async function main(): Promise<void> {
  rmSync(DATA_DIR, { recursive: true, force: true });

  console.log('› starting embedded postgres (UTF8)…');
  const pg = new EmbeddedPostgres({
    databaseDir: DATA_DIR,
    user: 'dpdpa',
    password: 'dpdpa',
    port: PG_PORT,
    persistent: false,
    initdbFlags: ['--encoding=UTF8', '--locale=C'],
    onLog: () => {},
  });
  await pg.initialise();
  await pg.start();
  await pg.createDatabase('dpdpa_sentinel');

  process.env.DATABASE_URL = DATABASE_URL;
  process.env.NODE_ENV = 'test';
  process.env.LOG_LEVEL = 'error';
  process.env.BACKEND_PORT = String(API_PORT);
  process.env.NLP_ENABLED = 'false';
  process.env.FRONTEND_URL = 'http://localhost:5173';

  console.log('› migrating and seeding…');
  const env = { ...process.env, DATABASE_URL };
  execSync('npx prisma migrate deploy', { env, stdio: 'pipe' });
  execSync('npx tsx prisma/seed.ts', { env, stdio: 'pipe' });

  const { createApp } = await import('../src/app.js');
  const { disconnectPrisma } = await import('../src/config/prisma.js');
  const { analysisQueue } = await import('../src/services/scanService.js');

  const server = createApp().listen(API_PORT);
  await new Promise((r) => server.once('listening', r));
  console.log(`› server listening on ${BASE}\n`);

  try {
    // ── Public ───────────────────────────────────────────────────────────
    console.log('Public endpoints');
    const health = await getJson(`${BASE}/api/health`);
    check('GET /api/health', health.status === 'ok', `rules=${health.rules} nlp=${health.nlp}`);

    const framework = await getJson(`${BASE}/api/framework`);
    check(
      'GET /api/framework',
      framework.totals.rules === 41 && framework.categories.length === 16,
      `${framework.totals.rules} rules / ${framework.categories.length} categories`,
    );
    check(
      'commencement surfaced',
      typeof framework.effectiveness.notYetInForce === 'number',
      `inForce=${framework.effectiveness.inForce} notYet=${framework.effectiveness.notYetInForce} unknown=${framework.effectiveness.unknown}`,
    );

    // ── CORS ─────────────────────────────────────────────────────────────
    const badOrigin = await fetch(`${BASE}/api/health`, { headers: { Origin: 'https://evil.example' } });
    check('CORS rejects an unlisted origin', badOrigin.status === 403, `status=${badOrigin.status}`);

    // ── Auth ─────────────────────────────────────────────────────────────
    console.log('\nAuthentication');
    const email = `verify-${Date.now()}@example.com`;
    const register = await post('/api/auth/register', {
      name: 'Verify User',
      email,
      password: 'a-sufficiently-long-password',
    });
    const registerBody = (await register.json()) as JsonBody;
    check('POST /api/auth/register', register.status === 201, `status=${register.status}`);
    check('no password hash in response', !JSON.stringify(registerBody).includes('passwordHash'));

    const token = registerBody.token as string;
    const me = await getJson(`${BASE}/api/auth/me`, { headers: auth(token) });
    check('GET /api/auth/me', me.user.email === email);

    const noAuth = await fetch(`${BASE}/api/scans`);
    check('protected route rejects anonymous', noAuth.status === 401);

    // ── Scan journey ─────────────────────────────────────────────────────
    console.log('\nScan journey');
    const form = new FormData();
    const policy = readFileSync(path.join(SAMPLES, '01-strong-fintech-policy.txt'));
    form.append('file', new Blob([policy], { type: 'text/plain' }), '01-strong-fintech-policy.txt');

    const upload = await fetch(`${BASE}/api/scans`, { method: 'POST', headers: auth(token), body: form });
    const uploadBody = (await upload.json()) as JsonBody;
    check('POST /api/scans returns 202', upload.status === 202, `status=${upload.status}`);
    const scanId = uploadBody.scan?.id as string;
    check('extraction ran synchronously', uploadBody.scan?.words > 0, `${uploadBody.scan?.words} words`);

    const stages: string[] = [];
    let status: JsonBody = {};
    for (let i = 0; i < 200; i += 1) {
      status = await getJson(`${BASE}/api/scans/${scanId}/status`, { headers: auth(token) });
      const stage = String(status.stage);
      if (stages[stages.length - 1] !== stage) stages.push(stage);
      if (status.status === 'COMPLETED' || status.status === 'FAILED') break;
      await new Promise((r) => setTimeout(r, 100));
    }
    check('analysis completes', status.status === 'COMPLETED', `stages: ${stages.join(' → ')}`);

    const detail = (await getJson(`${BASE}/api/scans/${scanId}`, { headers: auth(token) })).scan;
    check('score persisted', detail.score?.overallScore > 80, `score=${detail.score?.overallScore} (${detail.score?.verdict})`);
    check('risk persisted with factors', Array.isArray(detail.risk?.factors), `risk=${detail.risk?.level}`);
    check('findings persisted', detail.findings?.length === 41, `${detail.findings?.length} findings`);
    check('NLP degradation recorded', detail.nlpAvailable === false);

    const score = await getJson(`${BASE}/api/scans/${scanId}/score`, { headers: auth(token) });
    check('GET /score', score.score.scoringModel === 'design-doc-1.0', `model=${score.score.scoringModel}`);

    // ── Reports ──────────────────────────────────────────────────────────
    console.log('\nReports');
    const jsonRes = await fetch(`${BASE}/api/scans/${scanId}/report/json`, { headers: auth(token) });
    const reportText = await jsonRes.text();
    const report = JSON.parse(reportText) as JsonBody;
    check('GET /report/json', jsonRes.status === 200 && report.findings.length === 41);
    check('disclaimer present', report.report.disclaimer.includes('not a legal opinion'));

    const pdfRes = await fetch(`${BASE}/api/scans/${scanId}/report/pdf`, { headers: auth(token) });
    const pdf = Buffer.from(await pdfRes.arrayBuffer());
    check(
      'GET /report/pdf',
      pdfRes.status === 200 && pdf.subarray(0, 5).toString() === '%PDF-',
      `${(pdf.length / 1024).toFixed(1)} KB, sha256 header=${pdfRes.headers.get('x-checksum-sha256')?.slice(0, 12)}…`,
    );

    // ── Authorization boundary ───────────────────────────────────────────
    console.log('\nAuthorization boundary');
    const other = await post('/api/auth/register', {
      name: 'Other User',
      email: `other-${Date.now()}@example.com`,
      password: 'another-sufficiently-long-pw',
    });
    const otherToken = ((await other.json()) as JsonBody).token as string;
    const idor = await fetch(`${BASE}/api/scans/${scanId}`, { headers: auth(otherToken) });
    check("other user's scan returns 404 (not 403)", idor.status === 404, `status=${idor.status}`);

    const otherList = await getJson(`${BASE}/api/scans`, { headers: auth(otherToken) });
    check("other user's history is empty", otherList.scans.length === 0);

    // ── Cleanup path ─────────────────────────────────────────────────────
    console.log('\nDeletion');
    const del = await fetch(`${BASE}/api/scans/${scanId}`, { method: 'DELETE', headers: auth(token) });
    check('DELETE /api/scans/:id', del.status === 204);
    const gone = await fetch(`${BASE}/api/scans/${scanId}`, { headers: auth(token) });
    check('cascade removed the scan', gone.status === 404);
  } finally {
    await analysisQueue.idle();
    server.close();
    await disconnectPrisma();
    await pg.stop();
    rmSync(DATA_DIR, { recursive: true, force: true });
  }

  console.log(`\n${'─'.repeat(60)}`);
  console.log(`${passed} passed, ${failed} failed`);
  process.exit(failed === 0 ? 0 : 1);
}

/** Response bodies are checked structurally by the assertions below. */
type JsonBody = Record<string, any>;

async function getJson(url: string, init?: RequestInit): Promise<JsonBody> {
  const res = await fetch(url, init);
  return (await res.json()) as JsonBody;
}

function auth(token: string): Record<string, string> {
  return { Authorization: `Bearer ${token}` };
}

function post(pathname: string, body: unknown): Promise<Response> {
  return fetch(`${BASE}${pathname}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

main().catch((error: unknown) => {
  console.error('verification failed:', error);
  process.exit(1);
});
