import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const repoRoot = fileURLToPath(new URL('../../../', import.meta.url));

/**
 * Reference module for function-based MVC:
 * routes/ = endpoint registry only
 * controllers/nest/ = thin Nest HTTP adapters (framework classes only)
 * services/ = business logic factories
 * repositories/ = DB access functions
 * models/ = entity functions / plain data
 */
const REFERENCE_MVC_MODULE = 'tenants';

function walkJsFiles(dir, acc = []) {
  if (!existsSync(dir)) {
    return acc;
  }
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      walkJsFiles(full, acc);
    } else if (entry.name.endsWith('.js')) {
      acc.push(full);
    }
  }
  return acc;
}

describe('function-based MVC layout', () => {
  it('keeps Fastify-style route plugins out of src/modules', () => {
    const modulesRoot = join(repoRoot, 'src/modules');
    const routePlugins = walkJsFiles(modulesRoot).filter((path) => {
      const normalized = path.replaceAll('\\', '/');
      if (!normalized.endsWith('.routes.js')) {
        return false;
      }
      // Endpoint registries export ROUTE constants; Fastify plugins use withTypeProvider.
      const text = readFileSync(path, 'utf8');
      return text.includes('withTypeProvider') || text.includes('app.register');
    });
    expect(routePlugins, routePlugins.join('\n')).toEqual([]);
  });

  it('uses tenants as the reference: routes + thin Nest controller + function services/repos/models', () => {
    const root = join(repoRoot, 'src/modules', REFERENCE_MVC_MODULE);
    expect(existsSync(join(root, 'routes', 'tenant.routes.js'))).toBe(true);
    expect(existsSync(join(root, 'controllers', 'nest', 'tenants.controller.js'))).toBe(true);
    expect(existsSync(join(root, 'controllers', 'nest', 'tenants.service.js'))).toBe(false);

    const routes = readFileSync(join(root, 'routes', 'tenant.routes.js'), 'utf8');
    expect(routes).toMatch(/TENANT_ROUTES/);
    expect(routes).not.toMatch(/withTypeProvider/);
    expect(routes).not.toMatch(/execute\(/);

    const controller = readFileSync(join(root, 'controllers', 'nest', 'tenants.controller.js'), 'utf8');
    expect(controller).toMatch(/TENANT_ROUTES/);
    expect(controller).toMatch(/useCases/);
    expect(controller).not.toMatch(/repositories\//);

    const repo = readFileSync(join(root, 'repositories', 'postgres-tenant-repository.js'), 'utf8');
    expect(repo).toMatch(/export function createPostgresTenantRepository/);
    expect(repo).not.toMatch(/export class PostgresTenantRepository/);

    const model = readFileSync(join(root, 'models', 'tenant.js'), 'utf8');
    expect(model).toMatch(/export function createTenantEntity/);
    expect(model).not.toMatch(/export class Tenant/);

    const createTenant = readFileSync(join(root, 'services', 'create-tenant.js'), 'utf8');
    expect(createTenant).toMatch(/export function createCreateTenant/);
    expect(createTenant).not.toMatch(/export class CreateTenant/);
  });

  it('migrates api-keys Nest adapter to routes registry + thin controller (no Nest service class)', () => {
    const root = join(repoRoot, 'src/modules/api-keys');
    expect(existsSync(join(root, 'routes', 'api-key.routes.js'))).toBe(true);
    expect(existsSync(join(root, 'controllers', 'nest', 'api-keys.service.js'))).toBe(false);
    const controller = readFileSync(join(root, 'controllers', 'nest', 'api-keys.controller.js'), 'utf8');
    expect(controller).toMatch(/API_KEY_ROUTES/);
    expect(controller).toMatch(/CORE_SERVICES/);
  });

  describe.each([
    {
      module: 'mfa',
      routesFile: 'mfa.routes.js',
      routesConst: 'MFA_ROUTES',
      controller: 'mfa.controller.js',
      service: 'mfa.service.js',
    },
    {
      module: 'authorization',
      routesFile: 'authorization.routes.js',
      routesConst: 'AUTHORIZATION_ROUTES',
      controller: 'authorization.controller.js',
      service: 'authorization.service.js',
    },
    {
      module: 'identity',
      routesFile: 'auth.routes.js',
      routesConst: 'AUTH_ROUTES',
      controller: 'auth.controller.js',
      service: 'auth.service.js',
    },
    {
      module: 'products',
      routesFile: 'product.routes.js',
      routesConst: 'PRODUCT_ROUTES',
      controller: 'products.controller.js',
      service: 'products.service.js',
    },
    {
      module: 'pricing',
      routesFile: 'price.routes.js',
      routesConst: 'PRICE_ROUTES',
      controller: 'pricing.controller.js',
      service: 'pricing.service.js',
    },
    {
      module: 'offers',
      routesFile: 'offer.routes.js',
      routesConst: 'OFFER_ROUTES',
      controller: 'offers.controller.js',
      service: 'offers.service.js',
    },
    {
      module: 'inventory',
      routesFile: 'inventory.routes.js',
      routesConst: 'INVENTORY_ROUTES',
      controller: 'inventory.controller.js',
      service: 'inventory.service.js',
    },
  ])('migrates $module Nest adapter to routes registry + thin controller', (spec) => {
    const root = join(repoRoot, 'src/modules', spec.module);
    const nestDir = join(root, 'controllers', 'nest');

    it('has a routes registry and barrel', () => {
      expect(existsSync(join(root, 'routes', spec.routesFile))).toBe(true);
      expect(existsSync(join(root, 'routes', 'index.js'))).toBe(true);
      const routes = readFileSync(join(root, 'routes', spec.routesFile), 'utf8');
      expect(routes).toMatch(new RegExp(`export const ${spec.routesConst}\\b`));
      expect(routes).not.toMatch(/withTypeProvider/);
      expect(routes).not.toMatch(/execute\(/);
    });

    it('has no Nest *.service.js in controllers/nest', () => {
      expect(existsSync(join(nestDir, spec.service))).toBe(false);
      const services = existsSync(nestDir)
        ? readdirSync(nestDir).filter((name) => name.endsWith('.service.js'))
        : [];
      expect(services).toEqual([]);
    });

    it('uses CORE_SERVICES + route constants in the controller and empty module providers', () => {
      const controller = readFileSync(join(nestDir, spec.controller), 'utf8');
      expect(controller).toMatch(new RegExp(spec.routesConst));
      expect(controller).toMatch(/CORE_SERVICES/);
      expect(controller).toMatch(/useCases/);
      expect(controller).not.toMatch(/repositories\//);
      expect(controller).not.toMatch(/\.service\.js/);

      const moduleFile = readdirSync(nestDir).find((name) => name.endsWith('.module.js'));
      expect(moduleFile).toBeDefined();
      const moduleText = readFileSync(join(nestDir, moduleFile), 'utf8');
      expect(moduleText).toMatch(/providers:\s*\[\s*\]/);
      expect(moduleText).not.toMatch(/\.service\.js/);
    });
  });

  describe.each([
    {
      module: 'orders',
      routesFile: 'order.routes.js',
      routesConst: 'ORDER_ROUTES',
      controllers: [{ file: 'orders.controller.js', routesConst: 'ORDER_ROUTES', deps: 'useCases' }],
      services: ['orders.service.js'],
      paths: [
        'POST /api/v1/orders',
        'GET /api/v1/orders',
        'GET /api/v1/orders/:orderId',
        'POST /api/v1/orders/:orderId/confirm',
        'POST /api/v1/orders/:orderId/cancel',
      ],
    },
    {
      module: 'cancellations',
      routesFile: 'cancellation.routes.js',
      routesConst: 'CANCELLATION_ROUTES',
      controllers: [
        { file: 'cancellations.controller.js', routesConst: 'CANCELLATION_ROUTES', deps: 'useCases' },
      ],
      services: ['cancellations.service.js'],
      publicServiceShims: ['nest-cancellations-service.js'],
      paths: [
        'GET /api/v1/cancellations',
        'POST /api/v1/cancellations',
        'GET /api/v1/cancellations/:cancellationId',
      ],
    },
    {
      module: 'shipments',
      routesFile: 'shipment.routes.js',
      routesConst: 'SHIPMENT_ROUTES',
      controllers: [
        { file: 'shipments.controller.js', routesConst: 'SHIPMENT_ROUTES', deps: 'useCases' },
      ],
      services: ['shipments.service.js'],
      publicServiceShims: ['nest-shipments-service.js'],
      paths: [
        'POST /api/v1/orders/:orderId/shipments',
        'GET /api/v1/shipments',
        'GET /api/v1/shipments/:shipmentId',
        'POST /api/v1/shipments/:shipmentId/ship',
        'POST /api/v1/shipments/:shipmentId/deliver',
        'POST /api/v1/shipments/:shipmentId/cancel',
      ],
    },
    {
      module: 'returns',
      routesFile: 'return.routes.js',
      routesConst: 'RETURN_ROUTES',
      controllers: [{ file: 'returns.controller.js', routesConst: 'RETURN_ROUTES', deps: 'useCases' }],
      services: ['returns.service.js'],
      publicServiceShims: ['nest-returns-service.js'],
      paths: [
        'POST /api/v1/orders/:orderId/returns',
        'GET /api/v1/returns',
        'GET /api/v1/returns/:returnId',
        'POST /api/v1/returns/:returnId/approve',
        'POST /api/v1/returns/:returnId/receive',
        'POST /api/v1/returns/:returnId/complete',
        'POST /api/v1/returns/:returnId/reject',
        'POST /api/v1/returns/:returnId/cancel',
      ],
    },
    {
      module: 'marketplaces',
      routesFile: 'marketplace.routes.js',
      routesConst: 'MARKETPLACE_ROUTES',
      controllers: [
        { file: 'marketplaces.controller.js', routesConst: 'MARKETPLACE_ROUTES', deps: 'useCases' },
      ],
      services: ['marketplaces.service.js'],
      paths: [
        'GET /api/v1/marketplaces',
        'POST /api/v1/marketplaces',
        'GET /api/v1/marketplaces/:id',
        'PATCH /api/v1/marketplaces/:id',
      ],
    },
    {
      module: 'commerce-integrations',
      routesFile: 'commerce-integration.routes.js',
      routesConst: 'COMMERCE_INTEGRATION_ROUTES',
      controllers: [
        {
          file: 'commerce-integrations.controller.js',
          routesConst: 'COMMERCE_INTEGRATION_ROUTES',
          // Channel use cases are exposed as coreServices.channelRouteDeps (not `useCases`).
          deps: 'channelRouteDeps',
        },
      ],
      services: ['commerce-integrations.service.js'],
      paths: [
        'GET /api/v1/channels',
        'POST /api/v1/channels',
        'GET /api/v1/channels/:channelId',
        'PATCH /api/v1/channels/:channelId',
        'POST /api/v1/channels/:channelId/marketplace-connection',
        'GET /api/v1/channels/:channelId/marketplace-connection',
        'PATCH /api/v1/channels/:channelId/marketplace-connection',
        'DELETE /api/v1/channels/:channelId/marketplace-connection',
        'POST /api/v1/channels/:channelId/marketplace-connection/test',
      ],
    },
    {
      module: 'webhooks/outbound',
      routesFile: 'webhook.routes.js',
      routesConst: 'WEBHOOK_ROUTES',
      extraRoutesFiles: [
        { file: 'marketplace-webhook-ingress.routes.js', routesConst: 'MARKETPLACE_WEBHOOK_INGRESS_ROUTES' },
      ],
      controllers: [
        { file: 'webhook-subscriptions.controller.js', routesConst: 'WEBHOOK_ROUTES', deps: 'useCases' },
        {
          file: 'webhooks.controller.js',
          routesConst: 'MARKETPLACE_WEBHOOK_INGRESS_ROUTES',
          deps: 'useCases',
        },
      ],
      services: ['webhook-subscriptions.service.js', 'webhooks.service.js'],
      paths: [
        'POST /api/v1/webhooks',
        'GET /api/v1/webhooks',
        'GET /api/v1/webhooks/:webhookId',
        'PATCH /api/v1/webhooks/:webhookId',
        'DELETE /api/v1/webhooks/:webhookId',
        'POST /api/v1/webhooks/:webhookId/rotate-secret',
        'GET /api/v1/webhooks/:webhookId/deliveries',
        'GET /api/v1/webhooks/:webhookId/deliveries/:deliveryId',
        'POST /api/v1/inbound/marketplace-webhooks/:ingressToken',
      ],
    },
  ])('migrates $module Nest adapter to routes registry + thin controller (batch B)', (spec) => {
    const root = join(repoRoot, 'src/modules', spec.module);
    const nestDir = join(root, 'controllers', 'nest');
    const routesDir = join(root, 'routes');

    it('has routes registries and barrel with no Fastify plugins', () => {
      expect(existsSync(join(routesDir, 'index.js'))).toBe(true);
      const registries = [
        { file: spec.routesFile, routesConst: spec.routesConst },
        ...(spec.extraRoutesFiles ?? []),
      ];
      const barrel = readFileSync(join(routesDir, 'index.js'), 'utf8');
      for (const registry of registries) {
        expect(existsSync(join(routesDir, registry.file))).toBe(true);
        const routes = readFileSync(join(routesDir, registry.file), 'utf8');
        expect(routes).toMatch(new RegExp(`export const ${registry.routesConst}\\b`));
        expect(routes).not.toMatch(/withTypeProvider/);
        expect(routes).not.toMatch(/execute\(/);
        expect(barrel).toMatch(new RegExp(registry.routesConst));
      }
    });

    it('preserves exact HTTP methods and paths', () => {
      const registries = [
        { file: spec.routesFile },
        ...(spec.extraRoutesFiles ?? []),
      ];
      const found = [];
      for (const registry of registries) {
        const text = readFileSync(join(routesDir, registry.file), 'utf8');
        const re = /method: '([A-Z]+)',\s*path: '([^']+)'/g;
        for (const match of text.matchAll(re)) {
          found.push(`${match[1]} ${match[2]}`);
        }
      }
      expect(found.sort()).toEqual([...spec.paths].sort());
    });

    it('has no Nest *.service.js in controllers/nest or Nest service shims in public/', () => {
      for (const service of spec.services) {
        expect(existsSync(join(nestDir, service))).toBe(false);
      }
      const services = readdirSync(nestDir).filter((name) => name.endsWith('.service.js'));
      expect(services).toEqual([]);
      for (const shim of spec.publicServiceShims ?? []) {
        expect(existsSync(join(root, 'public', shim))).toBe(false);
      }
    });

    it('uses CORE_SERVICES + route constants in controllers and empty module providers', () => {
      for (const controllerSpec of spec.controllers) {
        const controller = readFileSync(join(nestDir, controllerSpec.file), 'utf8');
        expect(controller).toMatch(new RegExp(controllerSpec.routesConst));
        expect(controller).toMatch(/CORE_SERVICES/);
        expect(controller).toMatch(new RegExp(controllerSpec.deps));
        expect(controller).not.toMatch(/repositories\//);
        expect(controller).not.toMatch(/\.service\.js/);
        expect(controller).not.toMatch(/@Injectable/);
      }

      const moduleFiles = readdirSync(nestDir).filter((name) => name.endsWith('.module.js'));
      expect(moduleFiles.length).toBeGreaterThan(0);
      for (const moduleFile of moduleFiles) {
        const moduleText = readFileSync(join(nestDir, moduleFile), 'utf8');
        expect(moduleText).toMatch(/providers:\s*\[\s*\]/);
        expect(moduleText).not.toMatch(/\.service\.js/);
      }
    });
  });

  it('keeps order request mapping in orders views and idempotency in the orders controller', () => {
    const root = join(repoRoot, 'src/modules/orders');
    const mapper = readFileSync(join(root, 'views', 'order-request.mapper.js'), 'utf8');
    expect(mapper).toMatch(/export function mapCustomerInput/);
    const controller = readFileSync(join(root, 'controllers', 'nest', 'orders.controller.js'), 'utf8');
    expect(controller).toMatch(/order-request\.mapper\.js/);
    expect(controller).toMatch(/idempotency\.execute/);
    expect(controller).toMatch(/useTransaction: true/);
  });

  it('keeps Stock Connect off Nest services of migrated commerce modules', () => {
    const stockConnect = join(repoRoot, 'src/modules/erp/stock-connect');
    const integration = readFileSync(
      join(stockConnect, 'controllers', 'nest', 'stock-connect-integration.service.js'),
      'utf8',
    );
    expect(integration).toMatch(/createStockConnectCommerceCommands/);
    expect(integration).not.toMatch(/orders\.service|nest-shipments-service|nest-cancellations-service|commerce-integrations\.service/);
  });

  it('keeps mfa services and repositories as function factories, not classes', () => {
    const root = join(repoRoot, 'src/modules/mfa');
    const factoryFiles = [
      ['services/step-up-verifier.js', 'createStepUpService'],
      ['services/use-cases/start-totp-enrollment.js', 'createStartTotpEnrollment'],
      ['services/use-cases/verify-totp-enrollment.js', 'createVerifyTotpEnrollment'],
      ['services/use-cases/activate-totp-factor.js', 'createActivateTotpFactor'],
      ['services/use-cases/verify-mfa.js', 'createVerifyMfa'],
      ['services/use-cases/use-recovery-code.js', 'createUseRecoveryCode'],
      ['repositories/postgres-mfa-factor-repository.js', 'createPostgresMfaFactorRepository'],
      ['repositories/postgres-recovery-code-repository.js', 'createPostgresRecoveryCodeRepository'],
      ['repositories/postgres-step-up-session-repository.js', 'createPostgresStepUpSessionRepository'],
    ];
    for (const [file, factory] of factoryFiles) {
      const text = readFileSync(join(root, file), 'utf8');
      expect(text, file).toMatch(new RegExp(`export function ${factory}\\b`));
      expect(text, file).not.toMatch(/\bclass\s+\w+/);
    }

    const index = readFileSync(join(root, 'index.js'), 'utf8');
    expect(index).not.toMatch(/\bnew\s+\w+/);
    expect(index).not.toMatch(/\b(?:\w+UseCase|StepUpService|Postgres\w+Repository)\b/);

    const publicIndex = readFileSync(join(root, 'public', 'index.js'), 'utf8');
    expect(publicIndex).toMatch(/createStepUpService/);
    expect(publicIndex).not.toMatch(/\bStepUpService\b/);
  });

  it('migrates audit to function-based MVC with endpoint registry', () => {
    const root = join(repoRoot, 'src/modules/audit');
    expect(existsSync(join(root, 'routes', 'audit.routes.js'))).toBe(true);
    expect(existsSync(join(root, 'controllers', 'nest', 'audit.service.js'))).toBe(false);

    const routes = readFileSync(join(root, 'routes', 'audit.routes.js'), 'utf8');
    expect(routes).toMatch(/AUDIT_ROUTES/);
    expect(routes).not.toMatch(/withTypeProvider/);

    const controller = readFileSync(join(root, 'controllers', 'nest', 'audit.controller.js'), 'utf8');
    expect(controller).toMatch(/AUDIT_ROUTES/);
    expect(controller).toMatch(/CORE_SERVICES/);
    expect(controller).not.toMatch(/repositories\//);

    const repo = readFileSync(join(root, 'repositories', 'postgres-audit-repository.js'), 'utf8');
    expect(repo).toMatch(/export function createPostgresAuditRepository/);
    expect(repo).not.toMatch(/export class PostgresAuditRepository/);

    const service = readFileSync(join(root, 'services', 'audit-service.js'), 'utf8');
    expect(service).toMatch(/export function createAuditService/);
    expect(service).not.toMatch(/export class AuditService/);

    const recorder = readFileSync(join(root, 'services', 'default-audit-recorder.js'), 'utf8');
    expect(recorder).toMatch(/export function createDefaultAuditRecorder/);
    expect(recorder).not.toMatch(/export class DefaultAuditRecorder/);
  });
});
