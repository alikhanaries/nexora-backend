/**
 * Architecture boundary rules.
 *
 * These are executable architecture tests: `npm run arch:check` fails the build
 * when a layering rule is violated. Business modules do not exist yet, so the
 * module-scoped rules are written against the directory layout documented in
 * src/modules/README.md and start enforcing the moment those folders appear.
 */

/** Cross-module private layers (legacy clean-architecture). application/ is intentionally omitted — pre-existing couplings are phased out separately. */
const LEGACY_CROSS_MODULE_PRIVATE = '(domain|infrastructure|presentation)';

/** Cross-module private layers (physical MVC, e.g. orders). services/ omitted for the same reason as application/. */
const MVC_CROSS_MODULE_PRIVATE = '(models|repositories|views|controllers)';

const CROSS_MODULE_PRIVATE_LAYER = `(?:${LEGACY_CROSS_MODULE_PRIVATE}|${MVC_CROSS_MODULE_PRIVATE})`;

/** Compatibility adapter may not import these private layers in other modules. */
const COMPAT_FORBIDDEN_PRIVATE = '(domain|application|infrastructure|presentation|models|services|repositories|controllers|views)';

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
      name: 'models-no-infrastructure-layer',
      severity: 'error',
      comment: 'Model layer must not know how data is stored or transported.',
      from: { path: '^src/modules/[^/]+/models/' },
      to: { path: '^src/(infrastructure|app)/' },
    },
    {
      name: 'models-no-infrastructure-packages',
      severity: 'error',
      comment: 'Model code must stay free of infrastructure libraries.',
      from: { path: '^src/modules/[^/]+/models/' },
      to: { dependencyTypes: ['npm'], path: INFRASTRUCTURE_PACKAGES },
    },
    {
      name: 'models-no-module-repositories',
      severity: 'error',
      comment: 'Models must not depend on persistence or HTTP controllers.',
      from: { path: '^src/modules/[^/]+/models/' },
      to: { path: '^src/modules/[^/]+/(repositories|controllers)/' },
    },
    {
      name: 'application-no-presentation',
      severity: 'error',
      comment: 'Use cases must not depend on HTTP delivery details.',
      from: { path: '^src/modules/[^/]+/application/' },
      to: { path: '^src/modules/[^/]+/presentation/' },
    },
    {
      name: 'services-no-controllers',
      severity: 'error',
      comment: 'Application services must not depend on HTTP controllers.',
      from: { path: '^src/modules/[^/]+/services/' },
      to: { path: '^src/modules/[^/]+/controllers/' },
    },
    {
      name: 'services-no-nest',
      severity: 'error',
      comment: 'Application services must stay independent of NestJS.',
      from: { path: '^src/modules/[^/]+/services/' },
      to: { dependencyTypes: ['npm'], path: '^@nestjs/' },
    },
    {
      name: 'views-no-repositories',
      severity: 'error',
      comment: 'API views/presenters must not perform persistence.',
      from: { path: '^src/modules/[^/]+/views/' },
      to: { path: '^src/modules/[^/]+/repositories/' },
    },
    {
      name: 'repositories-no-controllers',
      severity: 'error',
      comment: 'Repositories must not depend on HTTP controllers.',
      from: { path: '^src/modules/[^/]+/repositories/' },
      to: { path: '^src/modules/[^/]+/controllers/' },
    },
    {
      name: 'no-cross-module-internals',
      severity: 'error',
      comment:
        'Modules integrate only through another module public interface, never private layer internals.',
      from: { path: '^src/modules/([^/]+)/' },
      to: {
        path: `^src/modules/([^/]+)/${CROSS_MODULE_PRIVATE_LAYER}/`,
        pathNot: '^src/modules/$1/',
      },
    },
    {
      name: 'core-no-compatibility',
      severity: 'error',
      comment:
        'Core business modules must remain provider-neutral and must not depend on the compatibility adapter.',
      from: {
        path: '^src/modules/',
        pathNot: '^src/modules/compatibility/',
      },
      to: { path: '^src/modules/compatibility/' },
    },
    {
      name: 'compatibility-no-direct-persistence',
      severity: 'error',
      comment:
        'The compatibility adapter translates to core public contracts; it must never touch repositories or the database directly.',
      from: { path: '^src/modules/compatibility/' },
      to: {
        path: `^(src/infrastructure/postgres/|src/modules/[^/]+/(?:infrastructure|repositories)/)`,
      },
    },
    {
      name: 'compatibility-no-module-index-imports',
      severity: 'error',
      comment:
        'Compatibility must integrate through another module public/ contracts, not its root index or private layers.',
      from: { path: '^src/modules/compatibility/' },
      to: {
        path: '^src/modules/([^/]+)/index\\.js$',
        pathNot: '^src/modules/compatibility/',
      },
    },
    {
      name: 'compatibility-public-contracts-only',
      severity: 'error',
      comment:
        'Compatibility must not import other modules private layers; public/ contracts are the only approved core entrypoint.',
      from: { path: '^src/modules/compatibility/' },
      to: {
        path: `^src/modules/([^/]+)/${COMPAT_FORBIDDEN_PRIVATE}/`,
        pathNot: '^src/modules/compatibility/',
      },
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
