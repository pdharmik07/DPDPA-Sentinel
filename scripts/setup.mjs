/**
 * Creates the local env files if they are missing and fills in a JWT secret.
 *
 * The documented setup used `openssl rand -base64 48`, which does not exist on
 * a stock Windows install, so the secret step failed silently and the backend
 * then refused to start. Node ships a CSPRNG, so there is no reason to shell
 * out to anything.
 *
 * Everything here is idempotent and never overwrites an existing file — the
 * previous instructions had people run `cp .env.example .env` a second time,
 * which wiped the secret they had already generated.
 */

import { randomBytes } from 'node:crypto';
import { copyFileSync, existsSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
const log = (message) => console.log(`  ${message}`);

/** Copy example → target, but only when the target does not exist yet. */
function ensureFile(target, example) {
  const abs = path.join(root, target);
  if (existsSync(abs)) {
    log(`${target} already exists — left alone`);
    return abs;
  }
  copyFileSync(path.join(root, example), abs);
  log(`created ${target}`);
  return abs;
}

/**
 * The server refuses to start on a secret under 32 characters, which is the
 * right call — but it has to be filled in for that check to pass.
 */
function ensureSecret(envPath) {
  const contents = readFileSync(envPath, 'utf8');
  const current = /^JWT_SECRET=(.*)$/m.exec(contents)?.[1]?.trim() ?? '';

  if (current.length >= 32) {
    log('JWT_SECRET already set — left alone');
    return;
  }

  const secret = randomBytes(48).toString('base64');
  const updated = /^JWT_SECRET=.*$/m.test(contents)
    ? contents.replace(/^JWT_SECRET=.*$/m, `JWT_SECRET=${secret}`)
    : `${contents}\nJWT_SECRET=${secret}\n`;

  writeFileSync(envPath, updated);
  log(current === '' ? 'generated a JWT_SECRET' : 'replaced a too-short JWT_SECRET');
}

export function setup() {
  console.log('Checking local configuration…');
  const backendEnv = ensureFile('backend/.env', 'backend/.env.example');
  ensureFile('frontend/.env.local', 'frontend/.env.example');
  ensureSecret(backendEnv);
  console.log('Configuration ready.\n');
}

// Only run when invoked directly (`npm run setup`), not when imported by dev.mjs.
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  setup();
}
