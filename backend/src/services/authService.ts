/**
 * Authentication.
 *
 * Passwords are hashed with Argon2id (@node-rs/argon2 — prebuilt binaries, so
 * no native toolchain is needed on Windows). Hashes are never returned from any
 * function in this module.
 */

import { hash, verify } from '@node-rs/argon2';
import { prisma } from '../config/prisma.js';
import { signToken } from '../middleware/index.js';
import { AppError } from '../utils/errors.js';

/** OWASP-aligned Argon2id parameters: 19 MiB, 2 passes, 1 lane. */
const ARGON_OPTIONS = {
  memoryCost: 19456,
  timeCost: 2,
  parallelism: 1,
} as const;

export interface PublicUser {
  id: string;
  name: string;
  email: string;
  createdAt: Date;
}

function toPublic(user: { id: string; name: string; email: string; createdAt: Date }): PublicUser {
  return { id: user.id, name: user.name, email: user.email, createdAt: user.createdAt };
}

export async function register(input: { name: string; email: string; password: string }) {
  const email = input.email.trim().toLowerCase();

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    throw AppError.conflict(
      'email_taken',
      'An account with that email already exists.',
      'Sign in instead, or use a different email address.',
    );
  }

  const passwordHash = await hash(input.password, ARGON_OPTIONS);
  const user = await prisma.user.create({
    data: { name: input.name.trim(), email, passwordHash },
  });

  return { user: toPublic(user), token: signToken({ sub: user.id, email: user.email }) };
}

export async function login(input: { email: string; password: string }) {
  const email = input.email.trim().toLowerCase();
  const user = await prisma.user.findUnique({ where: { email } });

  // Uniform failure: never reveal whether the email exists. Verifying against a
  // real throwaway hash keeps the timing of "no such account" comparable to
  // "wrong password", so the endpoint cannot be used to enumerate users.
  if (!user) {
    await verify(await getDummyHash(), input.password).catch(() => false);
    throw invalidCredentials();
  }

  const ok = await verify(user.passwordHash, input.password).catch(() => false);
  if (!ok) throw invalidCredentials();

  return { user: toPublic(user), token: signToken({ sub: user.id, email: user.email }) };
}

export async function getMe(userId: string): Promise<PublicUser> {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) throw AppError.unauthorized('Your account no longer exists.');
  return toPublic(user);
}

function invalidCredentials(): AppError {
  return new AppError(
    401,
    'invalid_credentials',
    'Email or password is incorrect.',
    'Check your details and try again.',
  );
}

/**
 * A genuine Argon2id hash of a throwaway value, computed once on first use and
 * cached. It exists only to equalise response time when the email does not
 * exist — it is not a credential and grants nothing.
 */
let dummyHash: Promise<string> | null = null;

function getDummyHash(): Promise<string> {
  dummyHash ??= hash('dpdpa-sentinel-login-timing-equaliser', ARGON_OPTIONS);
  return dummyHash;
}
