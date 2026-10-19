import js from '@eslint/js';
import prettier from 'eslint-config-prettier';
import globals from 'globals';

export default [
  {
    // Nest layer uses SWC decorator syntax (`export @Injectable()`); validated at runtime via register-swc.mjs.
    ignores: [
      'dist/**',
      'node_modules/**',
      'coverage/**',
      'scripts/**',
      'docs/**',
      // Nest decorator syntax (`export @Injectable()`); validated via SWC at runtime.
      'src/app/app.module.js',
      'src/app/common/**',
      'src/app/config/wasl-config.module.js',
      'src/app/database/**',
      'src/app/di/**',
      'src/modules/**/controllers/nest/**',
      'test/nest/**',
    ],
  },
  js.configs.recommended,
  {
    languageOptions: {
      ecmaVersion: 2023,
      sourceType: 'module',
      globals: { ...globals.node },
    },
    rules: {
      eqeqeq: ['error', 'always', { null: 'ignore' }],
      'no-console': 'error',
      'prefer-const': 'error',
      'no-unused-vars': ['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
      'no-restricted-globals': [
        'error',
        {
          name: 'process',
          message:
            'Read environment variables only in src/app/config. Inject typed configuration everywhere else.',
        },
      ],
    },
  },
  {
    files: ['src/app/config/**/*.js'],
    rules: { 'no-restricted-globals': 'off' },
  },
  {
    files: [
      'src/app/main.js',
      'src/app/migrate-cli.js',
      'src/app/create-*.js',
      'src/app/shutdown.js',
      'src/app/wire-*.js',
      'src/app/http/**/*.js',
      'src/workers/main.js',
      'src/workers/create-*.js',
      'src/workers/wire-*.js',
      'src/infrastructure/observability/**/*.js',
    ],
    rules: { 'no-restricted-globals': 'off' },
  },
  {
    files: ['tests/**/*.js', '**/*.test.js'],
    rules: {
      'no-restricted-globals': 'off',
    },
  },
  {
    files: ['src/app/http/**/*.js', 'src/workers/handlers/**/*.js'],
    rules: {},
  },
  {
    files: ['src/app/register-swc.mjs', 'tests/integration/node-swc-register.mjs'],
    rules: { 'no-restricted-globals': 'off' },
  },
  prettier,
];
