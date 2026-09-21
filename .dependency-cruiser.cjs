/**
 * Architecture boundary rules.
 *
 * These are executable architecture tests: `npm run arch:check` fails the build
 * when a layering rule is violated. Business modules do not exist yet, so the
 * module-scoped rules are written against the directory layout documented in
 * src/modules/README.md and start enforcing the moment those folders appear.
 */

/** Packages that must never be reachable from a domain layer. */
const INFRASTRUCTURE_PACKAGES = [
  '^fastify$',
  '^@fastify/',
  '^pg$',
  '^ioredis$',
  '^bullmq$',
  '^@aws-sdk/',
  '^pino$',
  '^prom-client$',
  '^@opentelemetry/',
  '^zod$',
];

module.exports = {
  forbidden: [
    {
      name: 'no-circular',
      severity: 'error',
      comment: 'Circular dependencies break module extraction and make reasoning impossible.',
      from: {},
      to: { circular: true },
    },
    {
      name: 'no-orphans',
      severity: 'warn',
      comment: 'An unreachable file is usually dead code.',
      from: { orphan: true, pathNot: ['(^|/)src/(app|workers)/main\\.js$'] },
      to: {},
    },
    {
      name: 'domain-no-infrastructure-layer',
      severity: 'error',
      comment: 'Domain logic must not know how data is stored or transported.',
      from: { path: '^src/modules/[^/]+/domain/' },
      to: { path: '^src/(infrastructure|app)/' },
    },
    {
      name: 'domain-no-infrastructure-packages',
      severity: 'error',
      comment:
        'Domain code must stay free of Fastify, PostgreSQL, Redis, BullMQ, S3, logging and validation libraries.',
      from: { path: '^src/modules/[^/]+/domain/' },
      to: { dependencyTypes: ['npm'], path: INFRASTRUCTURE_PACKAGES },
    },
    {
      name: 'domain-no-module-infrastructure',
      severity: 'error',
      comment: 'A domain layer must not reach into its own module infrastructure.',
      from: { path: '^src/modules/[^/]+/domain/' },
      to: { path: '^src/modules/[^/]+/(infrastructure|presentation)/' },
    },
    {
      name: 'application-no-presentation',
      severity: 'error',
      comment: 'Use cases must not depend on HTTP delivery details.',
      from: { path: '^src/modules/[^/]+/application/' },
      to: { path: '^src/modules/[^/]+/presentation/' },
    },
    {
      name: 'no-cross-module-internals',
      severity: 'error',
      comment:
        'Modules integrate only through another module public interface, never its domain, infrastructure or presentation internals.',
      from: { path: '^src/modules/([^/]+)/' },
      to: {
        path: '^src/modules/([^/]+)/(domain|infrastructure|presentation)/',
        pathNot: '^src/modules/$1/',
      },
    },
    {
      name: 'compatibility-no-direct-persistence',
      severity: 'error',
      comment:
        'The ChannelEngine compatibility facade translates to application interfaces; it must never touch repositories or the database directly.',
      from: { path: '^src/modules/channelengine-compatibility/' },
      to: { path: '^(src/infrastructure/postgres/|src/modules/[^/]+/infrastructure/)' },
    },
    {
      name: 'shared-stays-generic',
      severity: 'error',
      comment:
        'shared/ is a leaf: it must not depend on application wiring, infrastructure implementations or business modules.',
      from: { path: '^src/shared/' },
      to: { path: '^src/(app|infrastructure|modules|workers)/' },
    },
    {
      name: 'infrastructure-no-modules',
      severity: 'error',
      comment: 'Infrastructure implements shared ports; it must not depend on business modules.',
      from: { path: '^src/infrastructure/' },
      to: { path: '^src/(modules|app)/' },
    },
    {
      name: 'no-dev-dep-in-src',
      severity: 'error',
      comment: 'Runtime code must not import devDependencies.',
      from: { path: '^src/', pathNot: '\\.test\\.js$' },
      to: { dependencyTypes: ['npm-dev'] },
    },
    {
      name: 'not-to-deprecated-core',
      severity: 'error',
      comment: 'Deprecated Node core modules must not be used.',
      from: {},
      to: { dependencyTypes: ['core'], path: '^(punycode|domain|sys|constants)$' },
    },
  ],
  options: {
    doNotFollow: { path: 'node_modules' },
    enhancedResolveOptions: {
      exportsFields: ['exports'],
      conditionNames: ['import', 'require', 'node', 'default'],
      extensions: ['.js', '.json'],
    },
    reporterOptions: {
      text: { highlightFocused: true },
    },
  },
};
