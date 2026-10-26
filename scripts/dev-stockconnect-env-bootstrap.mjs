/**
 * Local Stock Connect ↔ Wasl: tenant, API key, stock location, publish channel.
 * Writes `.env.stockconnect.local` (gitignored). Hits Wasl HTTP APIs in-process.
 * Usage: node --env-file=.env --import ./src/app/register-swc.mjs scripts/dev-stockconnect-env-bootstrap.mjs
 */
import { randomBytes } from 'node:crypto';
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { loadConfigFromEnvironment } from '../src/app/config/index.js';
import { createInfrastructure } from '../src/app/create-infrastructure.js';
import { createApplication } from '../src/app/create-application.js';
import { createTenantsModule } from '../src/modules/tenants/index.js';

const SLUG = 'stockconnect-local';
const ADMIN_EMAIL = 'stockconnect@local.dev';
const ADMIN_PASSWORD = 'SecurePassword123!';
const BASE_URL = process.env.SERVER_PORT
  ? `http://localhost:${process.env.SERVER_PORT}`
  : 'http://localhost:3004';

function authHeaders(token) {
  return { authorization: `Bearer ${token}`, 'content-type': 'application/json' };
}

async function findTenantIdBySlug(database, slug) {
  const result = await database.execute(
    async (tx) =>
      tx.query('SELECT id FROM tenants WHERE slug = $1', [slug], {
        operation: 'bootstrap.find_tenant_by_slug',
      }),
    {},
  );
  return result.rows[0]?.id ?? null;
}

const config = loadConfigFromEnvironment();
const infra = await createInfrastructure(config);
const app = await createApplication(infra);
const tenants = createTenantsModule({
  transactionManager: infra.database,
  queryable: infra.database,
});
const server = app.httpServer;

let tenantId = await findTenantIdBySlug(infra.database, SLUG);
if (!tenantId) {
  const { tenant } = await tenants.useCases.createTenant.execute({
    slug: SLUG,
    name: 'Stock Connect Local',
  });
  tenantId = tenant.id;
}

await app.authorization.useCases.systemRoleSeeder.execute({ tenantId });

let user = await infra.database.execute(
  async (tx) =>
    tx.query(
      `SELECT u.id AS user_id, tm.id AS membership_id
       FROM users u
       JOIN tenant_memberships tm ON tm.user_id = u.id AND tm.tenant_id = $2
       WHERE lower(u.email) = lower($1)`,
      [ADMIN_EMAIL, tenantId],
      { operation: 'bootstrap.find_user' },
    ),
  { tenantId },
);

let userId;
let membershipId;
if (user.rows.length === 0) {
  const created = await app.identity.useCases.createUser.execute({
    email: ADMIN_EMAIL,
    password: ADMIN_PASSWORD,
  });
  userId = created.id;
  const membership = await app.identity.useCases.addMembership.execute({
    tenantId,
    userId,
  });
  membershipId = membership.id;
  await app.identity.useCases.activateMembership.execute({
    tenantId,
    membershipId,
  });
} else {
  userId = user.rows[0].user_id;
  membershipId = user.rows[0].membership_id;
}

const roles = await app.authorization.useCases.listRoles.execute({
  tenantId,
  actorPermissions: ['roles.read', 'tenant.admin'],
});
const ownerRole = roles.find((r) => r.systemKey === 'owner');
if (!ownerRole) {
  throw new Error('Owner role missing after system role seed');
}

const assigned = await infra.database.execute(
  async (tx) =>
    tx.query(
      'SELECT 1 FROM membership_roles WHERE membership_id = $1 AND role_id = $2',
      [membershipId, ownerRole.id],
      { operation: 'bootstrap.check_owner_role' },
    ),
  { tenantId },
);
if (assigned.rows.length === 0) {
  await app.authorization.useCases.assignRole.execute({
    tenantId,
    actorPermissions: ['roles.manage', 'tenant.admin'],
    membershipId,
    roleId: ownerRole.id,
  });
}

const login = await app.identity.useCases.login.execute({
  tenantSlug: SLUG,
  email: ADMIN_EMAIL,
  password: ADMIN_PASSWORD,
});
const headers = authHeaders(login.accessToken);

const suffix = randomBytes(4).toString('hex');
const marketplaceRes = await server.inject({
  method: 'POST',
  url: '/api/v1/marketplaces',
  headers,
  payload: { key: `sc_mp_${suffix}`, name: 'Stock Connect Marketplace' },
});
if (marketplaceRes.statusCode !== 201) {
  throw new Error(`marketplace create failed: ${marketplaceRes.statusCode} ${marketplaceRes.body}`);
}
const marketplaceId = marketplaceRes.json().data.id;

const locationRes = await server.inject({
  method: 'POST',
  url: '/api/v1/stock-locations',
  headers,
  payload: { name: 'Stock Connect Warehouse' },
});
if (locationRes.statusCode !== 201) {
  throw new Error(`stock location create failed: ${locationRes.statusCode} ${locationRes.body}`);
}
const stockLocationId = locationRes.json().data.id;

const channelRes = await server.inject({
  method: 'POST',
  url: '/api/v1/channels',
  headers,
  payload: {
    marketplaceId,
    name: 'Stock Connect Publish Channel',
    externalReference: `sc-ch-${suffix}`,
    defaultStockLocationId: stockLocationId,
  },
});
if (channelRes.statusCode !== 201) {
  throw new Error(`channel create failed: ${channelRes.statusCode} ${channelRes.body}`);
}
const publishChannelId = channelRes.json().data.id;

const effective = await app.authorization.useCases.getEffectivePermissions.execute({
  tenantId,
  actorPermissions: ['roles.read'],
  membershipId,
});

const integrationScopes = effective.permissions.filter((p) =>
  /^(products|orders|offers|inventory|channels|marketplaces|shipments|cancellations|returns|webhooks|api_keys)\./.test(
    p,
  ),
);
if (integrationScopes.length === 0) {
  throw new Error('No integration scopes resolved for owner');
}

const apiKey = await app.apiKeys.useCases.createApiKey.execute({
  tenantId,
  actorId: userId,
  actorPermissions: effective.permissions,
  name: 'Stock Connect local integration',
  scopes: integrationScopes,
  keyType: 'INTEGRATION',
});

const pingRes = await server.inject({
  method: 'GET',
  url: '/api/v2/stock-connect/ping',
  headers: { 'x-api-key': apiKey.secret },
});
const channelsRes = await server.inject({
  method: 'GET',
  url: '/api/v2/stock-connect/channels',
  headers: { 'x-api-key': apiKey.secret },
});
if (pingRes.statusCode !== 200) {
  throw new Error(`Stock Connect ping failed: ${pingRes.statusCode} ${pingRes.body}`);
}
if (channelsRes.statusCode !== 200) {
  throw new Error(`Stock Connect channels failed: ${channelsRes.statusCode} ${channelsRes.body}`);
}

const generatedAt = new Date().toISOString();
const outfile = join(process.cwd(), '.env.stockconnect.local');
const fileBody = `# Generated ${generatedAt} by scripts/dev-stockconnect-env-bootstrap.mjs
# Copy into Stock Connect (local Wasl on ${BASE_URL}). Do not commit.

# --- Dotenv / Stock Connect ---
WASL_BASE_URL=${BASE_URL}
WASL_API_KEY=${apiKey.secret}
WASL_TENANT_ID=${tenantId}
WASL_STOCK_LOCATION_ID=${stockLocationId}
WASL_PUBLISH_CHANNEL_ID=${publishChannelId}
COMMERCE_PROVIDER=wasl
WASL_TENANT_SLUG=${SLUG}

# --- Wasl admin (Postman / optional) ---
WASL_ADMIN_EMAIL=${ADMIN_EMAIL}
WASL_ADMIN_PASSWORD=${ADMIN_PASSWORD}

# --- Reference IDs ---
WASL_MARKETPLACE_ID=${marketplaceId}
WASL_API_KEY_ID=${apiKey.id}
WASL_API_KEY_PREFIX=${apiKey.prefix}

# --- PowerShell session ---
# $env:WASL_BASE_URL = "${BASE_URL}"
# $env:WASL_API_KEY = "${apiKey.secret}"
# $env:WASL_TENANT_ID = "${tenantId}"
# $env:WASL_STOCK_LOCATION_ID = "${stockLocationId}"
# $env:WASL_PUBLISH_CHANNEL_ID = "${publishChannelId}"
# $env:COMMERCE_PROVIDER = "wasl"
`;
writeFileSync(outfile, fileBody, 'utf8');

const summary = {
  generatedAt,
  credentialsFile: outfile,
  tenantSlug: SLUG,
  tenantId,
  stockLocationId,
  publishChannelId,
  marketplaceId,
  apiKeyId: apiKey.id,
  apiKeyPrefix: apiKey.prefix,
  verified: {
    stockConnectPing: pingRes.statusCode,
    stockConnectChannels: channelsRes.statusCode,
  },
  adminEmail: ADMIN_EMAIL,
  waslBaseUrl: BASE_URL,
};

console.log(JSON.stringify(summary, null, 2));
console.log(`\nWrote ${outfile} (includes WASL_API_KEY — gitignored)\n`);

await infra.database?.close?.();
process.exit(0);
