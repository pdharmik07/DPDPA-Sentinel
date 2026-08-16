import { createApp } from './app.js';
import { env } from './config/env.js';
import { logger } from './config/logger.js';
import { disconnectPrisma, prisma } from './config/prisma.js';
import { loadRulePack } from './engine/rulePack.js';
import { recoverStuckScans } from './services/scanService.js';

async function main(): Promise<void> {
  // Fail fast at boot rather than on the first request.
  const pack = loadRulePack();
  logger.info(
    { pack: pack.manifest.pack, ruleVersion: pack.manifest.ruleVersion, rules: pack.rules.length },
    'rule pack loaded',
  );

  await prisma.$queryRaw`SELECT 1`;
  logger.info('database connection ok');

  await recoverStuckScans();

  const app = createApp();
  const server = app.listen(env.BACKEND_PORT, () => {
    logger.info({ port: env.BACKEND_PORT, env: env.NODE_ENV }, 'DPDPA Sentinel backend listening');
  });

  const shutdown = (signal: string) => {
    logger.info({ signal }, 'shutting down');
    server.close(() => {
      void disconnectPrisma().finally(() => process.exit(0));
    });
    // Don't hang forever on a stuck connection.
    setTimeout(() => process.exit(1), 10_000).unref();
  };

  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));
}

main().catch((error: unknown) => {
  logger.fatal({ err: error }, 'failed to start');
  process.exit(1);
});
