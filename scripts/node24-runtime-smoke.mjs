/**
 * Node 24 live smoke against BASE_URL. Seeds via in-process Nest (no listen).
 */
import { randomBytes, randomUUID } from 'node:crypto';
import { config as loadEnv } from 'dotenv';
import { createApplication } from '../src/app/bootstrap/create-application.js';
import { PostgresMarketplaceConnectionRepository } from '../src/modules/marketplaces/infrastructure/postgres-marketplace-connection-repository.js';
import { hashWebhookIngressToken } from '../src/modules/marketplace-webhook-ingestion/application/webhook-ingress-token.js';
import { getTestInfrastructure } from '../tests/integration/helpers.js';
import { buildNoonFbpiOrderSyncEvent } from '../tests/unit/marketplaces/noon-event-fixtures.js';

loadEnv({ path: '.env', override: false });

const BASE_URL = process.env.SMOKE_BASE_URL ?? 'http://127.0.0.1:3000';
const NOON_MARKETPLACE_KEY = 'noon';
const ADMIN_PERMISSIONS = [
  'tenant.admin',
  'roles.read',
  'roles.manage',
  'users.read',
  'users.manage',
  'audit.read',
  'api_keys.read',
  'api_keys.manage',
  'mfa.manage',
];

async function fetchJson(path, options = {}) {
  const res = await fetch(`${BASE_URL}${path}`, options);
  const text = await res.text();
  let json;
  try {
    json = text.length > 0 ? JSON.parse(text) : null;
  } catch {
    json = { raw: text };
  }
  return { status: res.status, json };
}

function assertStatus(actual, expected, label) {
  if (actual !== expected) {
    throw new Error(`${label}: expected HTTP ${expected}, got ${actual}`);
  }
}

async function seedAuthenticatedUser(app, tenantSlug) {
  const tenantRes = await app.httpServer.inject({
    method: 'POST',
    url: '/api/v1/tenants',
    payload: { slug: tenantSlug, name: `Smoke ${tenantSlug}` },
  });
  assertStatus(tenantRes.statusCode, 201, 'create tenant');
  const tenantId = tenantRes.json().data.id;
  const email = `smoke-${randomUUID().slice(0, 8)}@example.com`;
  const password = 'SecurePassword123!';
  const user = await app.identity.useCases.createUser.execute({ email, password });
  const membership = await app.identity.useCases.addMembership.execute({ tenantId, userId: user.id });
  await app.identity.useCases.activateMembership.execute({ tenantId, membershipId: membership.id });
  await app.authorization.useCases.systemRoleSeeder.execute({ tenantId });
  const roles = await app.authorization.useCases.listRoles.execute({
    tenantId,
    actorPermissions: [...ADMIN_PERMISSIONS],
  });
  const ownerRole = roles.find((role) => role.systemKey === 'owner');
  if (ownerRole === undefined) {
    throw new Error('owner role missing after seed');
  }
  await app.authorization.useCases.assignRole.execute({
    tenantId,
    actorPermissions: [...ADMIN_PERMISSIONS],
    membershipId: membership.id,
    roleId: ownerRole.id,
  });
  const login = await app.identity.useCases.login.execute({ tenantSlug, email, password });
  return {
    tenantId,
    tenantSlug,
    email,
    password,
    accessToken: login.accessToken,
    headers: { authorization: `Bearer ${login.accessToken}` },
  };
}

const report = {};

try {
  const ready = await fetchJson('/health/ready');
  report.healthReady = { status: ready.status, body: ready.json };
  assertStatus(ready.status, 200, 'health ready');

  const ping = await fetchJson('/api/v1/foundation/ping');
  report.foundationPing = { status: ping.status, body: ping.json };
  assertStatus(ping.status, 200, 'foundation ping');

  const infra = await getTestInfrastructure();
  const app = await createApplication(infra);
  await app.httpServer.ready();

  const tenantSlug = `smoke-${randomBytes(4).toString('hex')}`;
  const auth = await seedAuthenticatedUser(app, tenantSlug);

  const loginRes = await fetchJson('/api/v1/auth/login', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ tenantSlug, email: auth.email, password: auth.password }),
  });
  const me = await fetchJson('/api/v1/auth/me', {
    headers: { authorization: `Bearer ${loginRes.json?.data?.accessToken}` },
  });
  report.authMe = {
    loginStatus: loginRes.status,
    meStatus: me.status,
    tenantId: auth.tenantId,
    emailMatch: me.json?.data?.email === auth.email,
  };
  assertStatus(loginRes.status, 200, 'login');
  assertStatus(me.status, 200, 'auth me');

  const listMp = await app.httpServer.inject({
    method: 'GET',
    url: '/api/v1/marketplaces',
    headers: auth.headers,
  });
  let marketplaceId = listMp.json().data.find((m) => m.key === NOON_MARKETPLACE_KEY)?.id;
  if (marketplaceId === undefined) {
    const createMp = await app.httpServer.inject({
      method: 'POST',
      url: '/api/v1/marketplaces',
      headers: auth.headers,
      payload: { key: NOON_MARKETPLACE_KEY, name: 'Noon' },
    });
    marketplaceId = createMp.json().data.id;
  }

  const suffix = randomBytes(4).toString('hex');
  const channelId = (
    await app.httpServer.inject({
      method: 'POST',
      url: '/api/v1/channels',
      headers: auth.headers,
      payload: { marketplaceId, name: `Smoke Noon ${suffix}` },
    })
  ).json().data.id;
  const stockLocationId = (
    await app.httpServer.inject({
      method: 'POST',
      url: '/api/v1/stock-locations',
      headers: auth.headers,
      payload: { name: `Smoke WH ${suffix}` },
    })
  ).json().data.id;
  await app.httpServer.inject({
    method: 'PATCH',
    url: `/api/v1/channels/${channelId}`,
    headers: auth.headers,
    payload: { defaultStockLocationId: stockLocationId },
  });
  await app.httpServer.inject({
    method: 'POST',
    url: `/api/v1/channels/${channelId}/marketplace-connection`,
    headers: auth.headers,
    payload: {
      credentials: { apiKey: 'smoke-noon-key' },
      configuration: { projectCode: 'smoke-project' },
    },
  });

  const ingressToken = `smoke-ingress-${suffix}`;
  const connections = new PostgresMarketplaceConnectionRepository();
  await infra.database.execute(async (tx) => {
    const active = await connections.findActiveByChannel(tx, auth.tenantId, channelId);
    if (active !== null) {
      await connections.updateWebhookIngressTokenHash(
        tx,
        auth.tenantId,
        active.id,
        hashWebhookIngressToken(ingressToken),
      );
    }
  }, { tenantId: auth.tenantId });

  const webhookId = `msg-noon-smoke-${suffix}`;
  const body = JSON.stringify(buildNoonFbpiOrderSyncEvent({
    metadata: { message_id: webhookId },
    payload: { order_nr: `NFBO-SMOKE-${suffix}` },
  }));
  const webhookHeaders = { 'content-type': 'application/json' };
  const webhookPath = `/api/v1/inbound/marketplace-webhooks/${ingressToken}`;
  const wh = await fetchJson(webhookPath, { method: 'POST', headers: webhookHeaders, body });
  const whReplay = await fetchJson(webhookPath, { method: 'POST', headers: webhookHeaders, body });

  report.webhook = {
    firstStatus: wh.status,
    firstBody: wh.json,
    replayStatus: whReplay.status,
    replayed: whReplay.json?.replayed,
    webhookId,
  };
  assertStatus(wh.status, 200, 'webhook first');
  if (whReplay.json?.replayed !== true) {
    throw new Error('webhook idempotency replay expected replayed=true');
  }

  report.queue = {
    note: 'Job enqueue validated via webhook HTTP 200 + idempotent replay; worker not started in smoke',
    healthQueueCheck: ready.json?.checks?.queue,
  };

  await app.httpServer.close();
  await infra.queue.close().catch(() => undefined);
  await infra.redis.close().catch(() => undefined);
  await infra.database.close().catch(() => undefined);

  console.log(JSON.stringify({ ok: true, report }, null, 2));
} catch (error) {
  console.log(JSON.stringify({ ok: false, message: error.message, report }, null, 2));
  process.exitCode = 1;
}
