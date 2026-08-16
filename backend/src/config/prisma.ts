import { PrismaClient } from '@prisma/client';
import { isProd } from './env.js';

export const prisma = new PrismaClient({
  log: isProd ? ['error'] : ['error', 'warn'],
});

export async function disconnectPrisma(): Promise<void> {
  await prisma.$disconnect();
}
