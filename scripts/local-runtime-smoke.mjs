#!/usr/bin/env node
/**
 * Live smoke tests against a running NestJS API.
 * Usage:
 *   API_BASE_URL=http://127.0.0.1:3000 node scripts/local-runtime-smoke.mjs
 */
const API_BASE = process.env.API_BASE_URL ?? process.env.NEST_BASE_URL ?? 'http://127.0.0.1:3000';

const LOGIN = {
  tenantSlug: process.env.SMOKE_TENANT_SLUG ?? 'wasl-dev',
  email: process.env.SMOKE_USER_EMAIL ?? 'admin@wasl.dev',
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
  record(results, `${label}: health live`, {
    ...(await req(base, 'GET', '/health/live')),
    result: 'pending',
  });
  const live = results[results.length - 1];
  live.result = live.status === 200 ? 'PASS' : 'FAIL';

  const loginRes = await login(base);
  record(results, `${label}: login`, {
    status: loginRes.status,
    result: loginRes.status === 200 && typeof loginRes.json?.data?.accessToken === 'string' ? 'PASS' : 'FAIL',
  });
  const token = loginRes.json?.data?.accessToken;
  if (typeof token !== 'string') {
    return null;
  }

  record(results, `${label}: GET /api/v1/products`, {
    ...(await req(base, 'GET', '/api/v1/products', { token })),
    result: 'pending',
  });
  const products = results[results.length - 1];
  products.result = products.status === 200 ? 'PASS' : 'FAIL';

  record(results, `${label}: GET /api/v1/orders unauth`, {
    ...(await req(base, 'GET', '/api/v1/orders')),
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

async function main() {
  const results = [];
  await runAgainst(API_BASE, 'api', results);

  const summary = {
    apiBase: API_BASE,
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
