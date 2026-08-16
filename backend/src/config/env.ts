import 'dotenv/config';
import { z } from 'zod';

/**
 * Environment contract. The process refuses to start if anything required is
 * missing or weak — a misconfigured JWT secret must fail loudly at boot, not
 * silently at the first login.
 */
const schema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),
  JWT_SECRET: z.string().min(32, 'JWT_SECRET must be at least 32 characters'),
  JWT_EXPIRES_IN: z.string().default('12h'),
  BACKEND_PORT: z.coerce.number().int().positive().default(4000),
  // Managed hosts (Render, Railway, Fly, Heroku) inject the port to bind as
  // PORT and route external traffic to it. Binding BACKEND_PORT instead makes
  // the service look dead to the platform's health check.
  PORT: z.coerce.number().int().positive().optional(),
  FRONTEND_URL: z.string().default('http://localhost:5173'),
  NLP_SERVICE_URL: z.string().url().default('http://localhost:8000'),
  NLP_TIMEOUT_MS: z.coerce.number().int().positive().default(15000),
  NLP_ENABLED: z.string().default('true').transform((v) => v !== 'false'),
  UPLOAD_MAX_SIZE: z.coerce.number().int().positive().default(10485760),
  UPLOAD_TMP_DIR: z.string().default('./uploads'),
  REPORT_DIR: z.string().default('./reports'),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace']).default('info'),
  ANALYSIS_CONCURRENCY: z.coerce.number().int().positive().max(8).default(2),
});

const parsed = schema.safeParse(process.env);

if (!parsed.success) {
  const issues = parsed.error.issues.map((i) => `  - ${i.path.join('.')}: ${i.message}`).join('\n');
  // Never print the values themselves — only which keys are wrong.
  console.error(
    `Invalid environment configuration:\n${issues}\n\nCopy backend/.env.example to backend/.env and fill it in.`,
  );
  process.exit(1);
}

export const env = parsed.data;

/** Strict CORS allowlist, parsed from the comma-separated FRONTEND_URL. */
export const allowedOrigins = env.FRONTEND_URL.split(',')
  .map((o) => o.trim())
  .filter(Boolean);

/** The port to bind: the platform's PORT wins, then BACKEND_PORT, then 4000. */
export const port = env.PORT ?? env.BACKEND_PORT;

export const isProd = env.NODE_ENV === 'production';
export const isTest = env.NODE_ENV === 'test';
