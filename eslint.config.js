import js from '@eslint/js';
import prettier from 'eslint-config-prettier';
import globals from 'globals';

export default [
  {
    ignores: ['dist/**', 'node_modules/**', 'coverage/**', 'scripts/**'],
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
      'src/workers/main.js',
      'src/app/bootstrap/**/*.js',
      'src/infrastructure/observability/**/*.js',
      'src/app/bootstrap/migrate-cli.js',
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
  prettier,
];
