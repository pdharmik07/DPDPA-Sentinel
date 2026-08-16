/**
 * One command that brings the whole app up: embedded PostgreSQL, the backend
 * API and the frontend dev server.
 *
 * The frontend on its own only ever renders "Cannot reach the DPDPA Sentinel
 * backend", because every screen (register, login, upload, results) is an API
 * call. Starting the backend was a separate manual step in a second terminal
 * and was easy to forget, so `npm run dev` now starts both.
 *
 * The backend half runs through backend/scripts/withDb.ts, which starts a
 * persistent embedded postgres on :55432 — no Docker, no global install — then
 * applies migrations, seeds the rule pack and runs the API.
 */

import { spawn } from 'node:child_process';
import net from 'node:net';
import { fileURLToPath } from 'node:url';
import { setup } from './setup.mjs';

const root = fileURLToPath(new URL('..', import.meta.url));
const BACKEND_PORT = Number(process.env.BACKEND_PORT ?? 4000);
const FRONTEND_URL = 'http://localhost:5173';

const colours = { backend: '\x1b[36m', frontend: '\x1b[35m', reset: '\x1b[0m' };
const children = [];
let shuttingDown = false;

/** Prefix every line so two interleaved servers stay readable. */
function pipe(stream, label) {
  let buffer = '';
  stream.setEncoding('utf8');
  stream.on('data', (chunk) => {
    buffer += chunk;
    const lines = buffer.split(/\r?\n/);
    buffer = lines.pop() ?? '';
    for (const line of lines) {
      process.stdout.write(`${colours[label]}[${label}]${colours.reset} ${line}\n`);
    }
  });
}

function start(label, command) {
  const child = spawn(command, {
    cwd: root,
    shell: true,
    stdio: ['inherit', 'pipe', 'pipe'],
    env: process.env,
  });
  pipe(child.stdout, label);
  pipe(child.stderr, label);
  child.on('exit', (code) => {
    if (shuttingDown) return;
    console.log(`\n${label} exited with code ${code ?? 0} — shutting the rest down.\n`);
    shutdown(code ?? 1);
  });
  children.push({ label, child });
  return child;
}

/**
 * Postgres must be given the chance to stop cleanly, otherwise the next run
 * finds :55432 still held. withDb.ts handles that on Ctrl+C, so the signal is
 * forwarded rather than the process being killed outright.
 */
function shutdown(code) {
  if (shuttingDown) return;
  shuttingDown = true;
  for (const { child } of children) {
    if (child.exitCode === null) child.kill('SIGINT');
  }

  // A Ctrl+C typed in the console reaches every process in the group, so the
  // servers and postgres wind themselves down. A shutdown started here (one
  // half crashed) only reaches the npm wrapper — Windows has no signal to
  // forward — so the tree is taken down explicitly after a grace period, or
  // postgres keeps :55432 and the next run refuses to start.
  setTimeout(() => {
    if (process.platform === 'win32') {
      for (const { child } of children) {
        if (child.exitCode === null && child.pid) {
          spawn('taskkill', ['/pid', String(child.pid), '/t', '/f'], { stdio: 'ignore' });
        }
      }
    }
    setTimeout(() => process.exit(code), 1500).unref();
  }, 3000).unref();
}

process.on('SIGINT', () => shutdown(0));
process.on('SIGTERM', () => shutdown(0));

/** Resolves once the API answers, so the "ready" banner is not a guess. */
async function waitForBackend(timeoutMs = 180_000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline && !shuttingDown) {
    const up = await new Promise((resolve) => {
      const socket = net.connect(BACKEND_PORT, '127.0.0.1');
      const settle = (value) => {
        socket.destroy();
        resolve(value);
      };
      socket.once('connect', () => settle(true));
      socket.once('error', () => settle(false));
      socket.setTimeout(1000, () => settle(false));
    });
    if (up) return true;
    await new Promise((r) => setTimeout(r, 500));
  }
  return false;
}

// Missing env files or an empty JWT_SECRET stop the backend dead, and the error
// arrives buried in server output. Fixing it here costs milliseconds.
setup();

console.log('Starting DPDPA Sentinel (database + backend + frontend)…\n');
console.log('First run takes a minute or two while postgres initialises.\n');

start('backend', 'npm run db:local:dev --prefix backend');
start('frontend', 'npm run dev --prefix frontend');

const ready = await waitForBackend();
if (ready && !shuttingDown) {
  console.log(
    `\n${colours.frontend}==> DPDPA Sentinel is ready: ${FRONTEND_URL}${colours.reset}\n` +
      `    API on http://localhost:${BACKEND_PORT}/api/health — press Ctrl+C to stop everything.\n`,
  );
} else if (!shuttingDown) {
  console.error(
    `\nThe backend did not come up on :${BACKEND_PORT}. The [backend] lines above say why.\n`,
  );
}
