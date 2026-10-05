import { defineConfig } from 'vitest/config';
import swc from 'unplugin-swc';

/**
 * - `unit` runs anywhere with no external dependencies.
 * - `integration` requires PostgreSQL, Redis and MinIO (see docker-compose.yml).
 *
 * Integration loads NestJS decorator syntax in `src/nest/*.js` via unplugin-swc
 * (SSR transform + inline deps). Jest covers dedicated Nest controller tests.
 */
export default defineConfig({
  plugins: [
    swc.vite({
      tsconfigFile: false,
      jsc: {
        parser: { syntax: 'ecmascript', decorators: true },
        transform: { legacyDecorator: true, decoratorMetadata: true },
        target: 'es2022',
      },
      module: { type: 'es6' },
    }),
  ],
  test: {
    server: {
      deps: {
        inline: [/^(?!.*node_modules).*\.js$/, /@nestjs\//],
      },
    },
    transformMode: {
      ssr: [/\.[cm]?js$/],
    },
    projects: [
      {
        extends: true,
        test: {
          name: 'unit',
          include: ['tests/unit/**/*.test.js'],
          environment: 'node',
        },
      },
      {
        extends: true,
        test: {
          name: 'integration',
          include: ['tests/integration/**/*.test.js'],
          environment: 'node',
          setupFiles: ['tests/integration/setup.js'],
          sequence: { concurrent: false },
          testTimeout: 30_000,
          hookTimeout: 60_000,
          fileParallelism: false,
          maxWorkers: 1,
          poolOptions: {
            forks: {
              execArgv: ['--import', './tests/integration/node-swc-register.mjs'],
            },
          },
        },
      },
    ],
  },
});
