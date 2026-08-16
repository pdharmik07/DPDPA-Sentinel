import pino from 'pino';
import { env, isProd } from './env.js';

/**
 * Structured logging.
 *
 * The redact list is a hard requirement, not a nicety: tokens, passwords and
 * extracted policy text must never reach the log stream.
 */
export const logger = pino({
  level: env.LOG_LEVEL,
  redact: {
    paths: [
      'req.headers.authorization',
      'req.headers.cookie',
      'req.body.password',
      'password',
      'passwordHash',
      'token',
      'accessToken',
      'extractedText',
      'evidence',
    ],
    censor: '[redacted]',
  },
  transport: isProd
    ? undefined
    : {
        target: 'pino-pretty',
        options: { colorize: true, translateTime: 'HH:MM:ss', ignore: 'pid,hostname' },
      },
});
