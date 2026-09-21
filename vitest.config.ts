import { defineConfig } from 'vitest/config';

/**
 * Two projects with different guarantees:
 *
 * - `unit` runs anywhere with no external dependencies.
 * - `integration` requires PostgreSQL, Redis and MinIO (see docker-compose.yml)
 *   and is therefore kept out of the default `npm test` run.
 */
export default defineConfig({
  test: {
    projects: [
      {
        test: {
          name: 'unit',
          include: ['tests/unit/**/*.test.ts'],
          environment: 'node',
        },
      },
      {
        test: {
          name: 'integration',
          include: ['tests/integration/**/*.test.ts'],
          environment: 'node',
          setupFiles: ['tests/integration/setup.ts'],
          sequence: { concurrent: false },
          testTimeout: 30_000,
          hookTimeout: 60_000,
        },
      },
    ],
  },
});
