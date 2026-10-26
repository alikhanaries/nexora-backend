/**
 * Upsert Noon marketplace connection for a channel using secrets from `.env.noon.local`.
 * Does NOT call POST …/marketplace-connection/test (Noon API).
 *
 * Usage:
 *   copy env.noon.local.example → .env.noon.local (fill values, never commit)
 *   node --env-file=.env --env-file=.env.noon.local --import ./src/app/register-swc.mjs scripts/dev-noon-connection-bootstrap.mjs
 */
import { loadConfigFromEnvironment } from '../src/app/config/index.js';
import { createInfrastructure } from '../src/app/create-infrastructure.js';
import { createApplication } from '../src/app/create-application.js';

const SLUG = process.env.WASL_TENANT_SLUG ?? 'stockconnect-local';
const ADMIN_EMAIL = process.env.WASL_ADMIN_EMAIL ?? 'stockconnect@local.dev';
const ADMIN_PASSWORD = process.env.WASL_ADMIN_PASSWORD;

function requireEnv(name) {
  const value = process.env[name]?.trim();
  if (value === undefined || value.length === 0) {
    throw new Error(`Missing ${name} in environment (use .env.noon.local)`);
  }
  return value;
}

function readPrivateKeyPem() {
  const inline = process.env.NOON_PRIVATE_KEY_PEM?.trim();
  if (inline !== undefined && inline.length > 0) {
    return inline.replace(/\\n/g, '\n');
  }
  throw new Error('NOON_PRIVATE_KEY_PEM is required in .env.noon.local');
}

const channelId = requireEnv('WASL_NOON_CHANNEL_ID');
const countryCode = requireEnv('NOON_COUNTRY_CODE');
const warehouseCode = requireEnv('NOON_WAREHOUSE_CODE');
const keyId = requireEnv('NOON_KEY_ID');
const projectCode = requireEnv('NOON_PROJECT_CODE');
const privateKeyPem = readPrivateKeyPem();

if (ADMIN_PASSWORD === undefined || ADMIN_PASSWORD.length === 0) {
  throw new Error('WASL_ADMIN_PASSWORD is required (e.g. from .env.stockconnect.local)');
}

const config = loadConfigFromEnvironment();
const infra = await createInfrastructure(config);
const app = await createApplication(infra);
const server = app.httpServer;
await server.ready();

const login = await app.identity.useCases.login.execute({
  tenantSlug: SLUG,
  email: ADMIN_EMAIL,
  password: ADMIN_PASSWORD,
});
const headers = {
  authorization: `Bearer ${login.accessToken}`,
  'content-type': 'application/json',
};

const connectionRes = await server.inject({
  method: 'POST',
  url: `/api/v1/channels/${channelId}/marketplace-connection`,
  headers,
  payload: {
    credentials: {
      keyId,
      projectCode,
      privateKey: privateKeyPem,
    },
    configuration: {
      countryCode,
      warehouseCode,
    },
  },
});

if (connectionRes.statusCode !== 201) {
  console.error(JSON.stringify({
    msg: 'marketplace-connection upsert failed',
    statusCode: connectionRes.statusCode,
    error: connectionRes.json()?.error?.code,
  }));
  process.exitCode = 1;
} else {
  const data = connectionRes.json().data;
  console.log(JSON.stringify({
    msg: 'marketplace-connection upsert succeeded',
    connectionId: data.id,
    channelId: data.channelId,
    marketplaceKey: data.marketplaceKey,
    configuration: data.configuration,
    credentialsReturned: data.credentials !== undefined,
  }, null, 2));
}

await infra.database?.close?.();
process.exit(process.exitCode ?? 0);
