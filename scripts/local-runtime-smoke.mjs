#!/usr/bin/env node
/**
 * Live smoke tests against a running Nest (and optional Fastify) instance.
 * Usage:
 *   NEST_BASE_URL=http://127.0.0.1:3010 node scripts/local-runtime-smoke.mjs
 *   FASTIFY_BASE_URL=http://127.0.0.1:3000 node scripts/local-runtime-smoke.mjs
 */
const NEST_BASE = process.env.NEST_BASE_URL ?? 'http://127.0.0.1:3010';
const FASTIFY_BASE = process.env.FASTIFY_BASE_URL ?? '';

const LOGIN = {
  tenantSlug: process.env.SMOKE_TENANT_SLUG ?? 'nexora-dev',
  email: process.env.SMOKE_USER_EMAIL ?? 'admin@nexora.dev',
  password: process.env.SMOKE_USER_PASSWORD ?? 'SecurePassword123!',
};

/** @param {string} base @param {string} method @param {string} path @param {object} [opts] */
async function req(base, method, path, opts = {}) {
  const url = `${base}${path}`;
  const headers = { ...(opts.headers ?? {}) };
  if (opts.token) {
    headers.Authorization = `Bearer ${opts.token}`;
  }
  if (opts.body !== undefined && !headers['Content-Type']) {
    headers['Content-Type'] = 'application/json';
  }
  const response = await fetch(url, {
    method,
    headers,
    body: opts.body === undefined ? undefined : JSON.stringify(opts.body),
  });
  const text = await response.text();
  let json = null;
  try {
    json = JSON.parse(text);
  } catch {
    json = text;
  }
  return { status: response.status, json, headers: Object.fromEntries(response.headers) };
}

function record(results, name, detail) {
  results.push({ name, ...detail });
}

async function login(base) {
  return req(base, 'POST', '/api/v1/auth/login', { body: LOGIN });
}

async function runAgainst(base, label, results) {
  record(results, `${label}: health/live`, {
    ...(await req(base, 'GET', '/health/live')),
    result: 'pending',
  });
  const last = results[results.length - 1];
  last.result = last.status === 200 ? 'PASS' : 'FAIL';

  record(results, `${label}: auth login`, { ...(await login(base)), result: 'pending' });
  const loginRow = results[results.length - 1];
  if (loginRow.status !== 200 || loginRow.json?.success !== true) {
    loginRow.result = 'FAIL';
    return null;
  }
  loginRow.result = 'PASS';
  const token = loginRow.json.data.accessToken;

  const authedGets = [
    '/api/v1/products',
    '/api/v1/prices',
    '/api/v1/offers',
    '/api/v1/stock-locations',
    '/api/v1/channels',
    '/api/v1/marketplaces',
    '/api/v1/orders',
    '/api/v1/cancellations',
    '/api/v1/shipments',
    '/api/v1/returns',
    '/api/v2/foundation/ping',
    '/api/v2/orders',
    '/api/v2/shipments/merchant',
    '/api/v2/cancellations/merchant',
    '/api/v2/returns/merchant/new',
    '/api/v2/ce/channels',
  ];

  for (const path of authedGets) {
    const r = await req(base, 'GET', path, { token });
    record(results, `${label}: GET ${path}`, {
      status: r.status,
      envelope: r.json?.success ?? r.json?.Success ?? null,
      result: r.status >= 200 && r.status < 300 ? 'PASS' : 'FAIL',
    });
  }

  record(results, `${label}: GET /api/v1/products unauthenticated`, {
    ...(await req(base, 'GET', '/api/v1/products')),
    result: 'pending',
  });
  const unauth = results[results.length - 1];
  unauth.result = unauth.status === 401 ? 'PASS' : 'FAIL';

  record(results, `${label}: GET /api/v2/products missing sku`, {
    ...(await req(base, 'GET', '/api/v2/products', { token })),
    result: 'pending',
  });
  const v2prod = results[results.length - 1];
  v2prod.result = v2prod.status === 400 && v2prod.json?.Success === false ? 'PASS' : 'FAIL';

  return token;
}

async function comparePair(nestRes, fastifyRes, name, results) {
  const match =
    nestRes.status === fastifyRes.status
    && JSON.stringify(nestRes.json) === JSON.stringify(fastifyRes.json);
  record(results, `compare: ${name}`, {
    nestStatus: nestRes.status,
    fastifyStatus: fastifyRes.status,
    bodyMatch: JSON.stringify(nestRes.json) === JSON.stringify(fastifyRes.json),
    result: match ? 'PASS' : 'FAIL',
  });
}

async function main() {
  const results = [];

  const nestToken = await runAgainst(NEST_BASE, 'nest', results);

  if (FASTIFY_BASE.length > 0) {
    const fastifyToken = await runAgainst(FASTIFY_BASE, 'fastify', results);
    if (nestToken && fastifyToken) {
      const paths = ['/api/v1/products', '/api/v1/orders', '/api/v2/foundation/ping'];
      for (const path of paths) {
        const n = await req(NEST_BASE, 'GET', path, { token: nestToken });
        const f = await req(FASTIFY_BASE, 'GET', path, { token: fastifyToken });
        await comparePair(n, f, path, results);
      }
    }
  }

  const summary = {
    nestBase: NEST_BASE,
    fastifyBase: FASTIFY_BASE || null,
    pass: results.filter((r) => r.result === 'PASS').length,
    fail: results.filter((r) => r.result === 'FAIL').length,
    results,
  };
  process.stdout.write(`${JSON.stringify(summary, null, 2)}\n`);
  process.exitCode = summary.fail > 0 ? 1 : 0;
}

main().catch((error) => {
  process.stderr.write(`${error.stack ?? error}\n`);
  process.exitCode = 1;
});
