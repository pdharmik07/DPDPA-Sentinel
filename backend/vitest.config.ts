import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // The integration suite boots a real PostgreSQL server; it must not share a
    // port or a Prisma client with the pure-engine suite, so files run serially.
    fileParallelism: false,
    testTimeout: 60_000,
    hookTimeout: 300_000,
    include: ['tests/**/*.test.ts'],
  },
});
