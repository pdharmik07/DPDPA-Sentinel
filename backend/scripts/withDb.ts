/**
 * Runs a command against a throwaway embedded PostgreSQL instance.
 *
 * Docker is not available on every machine (Docker Desktop on Windows Home
 * requires WSL2), so this gives migrations, seeding and integration tests a real
 * PostgreSQL server with no Docker, no admin rights and no global install.
 *
 *   npx tsx scripts/withDb.ts "npx prisma migrate dev --name init"
 *   npx tsx scripts/withDb.ts "npm run db:seed"
 *
 * The data directory is removed on exit unless --persist is passed.
 */

import { spawn } from 'node:child_process';
import net from 'node:net';
import { existsSync, rmSync } from 'node:fs';
import path from 'node:path';
import EmbeddedPostgres from 'embedded-postgres';

const PORT = Number(process.env.EMBEDDED_PG_PORT ?? 55432);
const USER = 'dpdpa';
const PASSWORD = 'dpdpa';
const DATABASE = 'dpdpa_sentinel';

const persist = process.argv.includes('--persist');
const command = process.argv.slice(2).filter((a) => a !== '--persist').join(' ');

if (!command) {
  console.error('usage: tsx scripts/withDb.ts "<command>" [--persist]');
  process.exit(1);
}

const dataDir = path.resolve(process.cwd(), '.pgdata');
export const DATABASE_URL = `postgresql://${USER}:${PASSWORD}@localhost:${PORT}/${DATABASE}?schema=public&connect_timeout=5&pool_timeout=10`;

const sleep = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms));

/** Resolves true when nothing is listening on the port. */
function isPortFree(port: number): Promise<boolean> {
  return new Promise((resolve) => {
    const probe = net.createServer();
    probe.once('error', () => resolve(false));
    probe.once('listening', () => probe.close(() => resolve(true)));
    probe.listen(port, '127.0.0.1');
  });
}

/**
 * Wait for the port, then fail with something actionable.
 *
 * embedded-postgres waits indefinitely for a server that will never come up,
 * which presents as a silent hang. The grace period matters because postgres
 * does not release the socket the instant `stop()` resolves, so two runs
 * back-to-back would otherwise collide.
 */
async function assertPortFree(port: number, graceMs = 15_000): Promise<void> {
  const deadline = Date.now() + graceMs;
  let warned = false;

  while (Date.now() < deadline) {
    if (await isPortFree(port)) return;
    if (!warned) {
      console.log(`port ${port} is busy — waiting for it to be released…`);
      warned = true;
    }
    await sleep(500);
  }

  throw new Error(
    `port ${port} is still in use after ${graceMs / 1000}s — another postgres is probably running.\n` +
      `  Stop it, or pick another port:  EMBEDDED_PG_PORT=55440 npm run db:local:setup`,
  );
}

/**
 * postgres keeps child processes alive briefly after shutdown is requested.
 * Exiting before the socket is released makes an immediate re-run fail, so the
 * harness waits for it.
 */
async function waitForPortRelease(port: number, timeoutMs = 15_000): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (await isPortFree(port)) return;
    await sleep(250);
  }
  console.warn(`port ${port} was still held ${timeoutMs / 1000}s after shutdown`);
}

/** A data directory that has been through initdb contains PG_VERSION. */
function clusterExists(dir: string): boolean {
  return existsSync(path.join(dir, 'PG_VERSION'));
}

/**
 * Windows can hold locks on files inside a just-stopped data directory, so a
 * single rmSync is not always enough.
 */
function removeDataDir(dir: string): void {
  for (let attempt = 0; attempt < 5; attempt += 1) {
    try {
      rmSync(dir, { recursive: true, force: true });
      if (!existsSync(dir)) return;
    } catch {
      /* retry below */
    }
    Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 200);
  }
  if (existsSync(dir)) {
    console.warn(`could not fully remove ${dir}; delete it manually if the next run complains`);
  }
}

async function main(): Promise<void> {
  await assertPortFree(PORT);

  if (!persist) removeDataDir(dataDir);

  // On a repeat --persist run the cluster is already initialised; running
  // initdb again fails with "directory exists but is not empty".
  const reuseExisting = persist && clusterExists(dataDir);
  if (reuseExisting) console.log('reusing the existing local cluster');

  const pg = new EmbeddedPostgres({
    databaseDir: dataDir,
    user: USER,
    password: PASSWORD,
    port: PORT,
    persistent: persist,
    // initdb otherwise inherits the Windows locale and creates a WIN1252
    // cluster, which cannot store the em-dashes and arrows in the rule pack.
    // The postgres:16-alpine image used in docker-compose is UTF8, so this
    // keeps the local harness faithful to production.
    initdbFlags: ['--encoding=UTF8', '--locale=C'],
    onLog: () => {
      /* postgres chatter is noise unless something fails */
    },
  });

  console.log(`starting embedded postgres on :${PORT} …`);
  if (!reuseExisting) await pg.initialise();
  await pg.start();

  // Only create the database on a freshly initialised cluster. On a reused
  // --persist cluster it already exists, and attempting it again drops the
  // admin connection ("Connection terminated unexpectedly").
  if (!reuseExisting) {
    try {
      await pg.createDatabase(DATABASE);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (!/already exists/i.test(message)) throw error;
    }
  }
  console.log('postgres ready');

  const code = await run(command);

  console.log('stopping postgres …');
  await pg.stop();
  // stop() resolves before the postmaster's children have gone; wait for the
  // socket so that running this command again immediately still works.
  await waitForPortRelease(PORT);
  if (!persist) removeDataDir(dataDir);

  process.exit(code);
}

function run(cmd: string): Promise<number> {
  return new Promise((resolve) => {
    const child = spawn(cmd, {
      shell: true,
      stdio: 'inherit',
      env: { ...process.env, DATABASE_URL },
    });
    child.on('exit', (code) => resolve(code ?? 1));
  });
}

main().catch((error: unknown) => {
  // embedded-postgres sometimes rejects with undefined or a bare object, which
  // produced the useless message "harness failed: undefined". Dig out whatever
  // detail exists and always finish with something the reader can act on.
  const detail =
    error instanceof Error
      ? (error.stack ?? error.message)
      : error === undefined || error === null
        ? '(the postgres binary exited without reporting a reason)'
        : typeof error === 'object'
          ? JSON.stringify(error, null, 2)
          : String(error);

  console.error(`\nembedded postgres harness failed:\n${detail}\n`);
  console.error('Common causes:');
  console.error(`  · another postgres is already on port ${PORT}`);
  console.error(`  · a half-written data directory — delete ${dataDir} and retry`);
  console.error('  · leftover postgres processes from a previous run holding shared memory');
  console.error('\nTo start completely fresh:');
  console.error(`  npx tsx scripts/withDb.ts "<command>"        (no --persist: uses a throwaway cluster)`);
  process.exit(1);
});
