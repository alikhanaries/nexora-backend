import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import prettier from 'eslint-config-prettier';
import globals from 'globals';

export default tseslint.config(
  {
    ignores: ['dist/**', 'node_modules/**', 'coverage/**'],
  },
  js.configs.recommended,
  ...tseslint.configs.recommendedTypeChecked,
  {
    languageOptions: {
      globals: { ...globals.node },
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
      // `any` defeats the strict-typing requirement. Integration boundaries must
      // narrow from `unknown` instead, and document any unavoidable exception.
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/no-unsafe-assignment': 'error',
      '@typescript-eslint/no-unsafe-member-access': 'error',
      '@typescript-eslint/no-unsafe-call': 'error',
      '@typescript-eslint/no-unsafe-return': 'error',
      '@typescript-eslint/no-unsafe-argument': 'error',
      '@typescript-eslint/no-floating-promises': 'error',
      '@typescript-eslint/no-misused-promises': 'error',
      '@typescript-eslint/consistent-type-imports': [
        'error',
        { prefer: 'type-imports', fixStyle: 'separate-type-imports' },
      ],
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
      '@typescript-eslint/require-await': 'error',
      '@typescript-eslint/switch-exhaustiveness-check': 'error',
      eqeqeq: ['error', 'always', { null: 'ignore' }],
      'no-console': 'error',
      'prefer-const': 'error',
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
    // The configuration module is the single authorised reader of process.env.
    files: ['src/app/config/**/*.ts'],
    rules: { 'no-restricted-globals': 'off' },
  },
  {
    // Entrypoints and the shutdown path need process signals/exit codes.
    files: [
      'src/app/main.ts',
      'src/workers/main.ts',
      'src/app/bootstrap/**/*.ts',
      'src/infrastructure/observability/**/*.ts',
      'src/app/bootstrap/migrate-cli.ts',
    ],
    rules: { 'no-restricted-globals': 'off' },
  },
  {
    files: ['tests/**/*.ts', '**/*.test.ts'],
    rules: {
      'no-restricted-globals': 'off',
      '@typescript-eslint/no-unsafe-assignment': 'off',
      '@typescript-eslint/no-unsafe-member-access': 'off',
      '@typescript-eslint/require-await': 'off',
    },
  },
  {
    files: ['src/app/http/**/*.ts', 'src/workers/handlers/**/*.ts'],
    rules: { '@typescript-eslint/require-await': 'off' },
  },
  {
    files: ['**/*.js', '**/*.cjs'],
    ...tseslint.configs.disableTypeChecked,
  },
  prettier,
);
