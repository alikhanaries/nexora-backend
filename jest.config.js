/** @type {import('jest').Config} */
export default {
  testEnvironment: 'node',
  setupFilesAfterEnv: ['<rootDir>/test/nest/setup.js'],
  testMatch: ['<rootDir>/test/nest/**/*.test.js'],
  transform: {
    '^.+\\.js$': [
      '@swc/jest',
      {
        jsc: {
          parser: { syntax: 'ecmascript', decorators: true },
          transform: { legacyDecorator: true, decoratorMetadata: true },
          target: 'es2022',
        },
        module: { type: 'es6' },
      },
    ],
  },
  moduleFileExtensions: ['js', 'json'],
  extensionsToTreatAsEsm: [],
};
