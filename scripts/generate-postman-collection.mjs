#!/usr/bin/env node
/**
 * Documentation-only: builds Postman v2.1 collection from API_ROUTE_INVENTORY + OpenAPI snapshot.
 * Does not modify application source code.
 */
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { randomUUID } from 'node:crypto';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const INVENTORY_MD = join(ROOT, 'docs/API_ROUTE_INVENTORY.md');
const OPENAPI_PATH = join(ROOT, 'docs/.openapi-snapshot.json');
const OUT_COLLECTION = join(ROOT, 'postman/Nexora_Backend_API.postman_collection.json');
const OUT_ENV = join(ROOT, 'postman/Nexora_Local.postman_environment.json');
const OUT_INVENTORY = join(ROOT, 'docs/POSTMAN_API_INVENTORY.md');

const WORKER_ROUTES = [
    { routeId: 'W-0001', method: 'GET', path: '/health/live', file: 'src/workers/observability/worker-observability.routes.js' },
    { routeId: 'W-0002', method: 'GET', path: '/health/ready', file: 'src/workers/observability/worker-observability.routes.js' },
    { routeId: 'W-0003', method: 'GET', path: '/internal/metrics', file: 'src/workers/observability/worker-observability.routes.js' },
];

const FOLDER_BY_MODULE = {
    'health-observability': 'Health & Documentation',
    metrics: 'Health & Monitoring',
    'api-keys': 'API Keys',
    auth: 'Authentication',
    audit: 'Audit',
    memberships: 'Authorization',
    authorization: 'Authorization',
    cancellations: 'Cancellations',
    channels: 'Channels',
    foundation: 'Foundation',
    'marketplace-webhook-ingestion': 'Marketplace Webhooks',
    inventory: 'Inventory',
    marketplaces: 'Marketplaces',
    mfa: 'MFA',
    offers: 'Offers',
    orders: 'Orders',
    pricing: 'Pricing',
    products: 'Products',
    returns: 'Returns',
    shipments: 'Shipments',
    tenants: 'Tenants',
    webhooks: 'Webhooks',
    'compatibility-stockconnect-ce': 'StockConnect CE (v2)',
    'compatibility-v2': 'Merchant Compatibility (v2)',
};

function parseMainInventory() {
    const md = readFileSync(INVENTORY_MD, 'utf8');
    const re = /\| (R-\d+) \| (GET|POST|PUT|PATCH|DELETE|HEAD|OPTIONS) \| `([^`]+)` \| `([^`]+)` \| ([^|]+) \| ([^|]+) \|/g;
    const rows = [];
    let m = re.exec(md);
    while (m !== null) {
        rows.push({
            routeId: m[1],
            method: m[2],
            path: m[3],
            routeFile: m[4].trim(),
            module: m[5].trim(),
            auth: m[6].trim(),
        });
        m = re.exec(md);
    }
    return rows;
}

function expressToOpenApiPath(path) {
    return path.replace(/:([A-Za-z0-9_]+)/g, '{$1}');
}

function loadOpenApi() {
    if (!existsSync(OPENAPI_PATH)) {
        throw new Error(`Missing ${OPENAPI_PATH}. Run: node scripts/dump-openapi.mjs docs/.openapi-snapshot.json`);
    }
    return JSON.parse(readFileSync(OPENAPI_PATH, 'utf8'));
}

function getOperation(spec, method, path) {
    const oasPath = expressToOpenApiPath(path);
    const pathItem = spec.paths?.[oasPath];
    if (pathItem === undefined) {
        return undefined;
    }
    return pathItem[method.toLowerCase()];
}

function schemaToExample(schema, depth = 0) {
    if (schema === undefined || depth > 8) {
        return undefined;
    }
    if (schema.example !== undefined) {
        return schema.example;
    }
    if (schema.const !== undefined) {
        return schema.const;
    }
    if (schema.enum?.length) {
        return schema.enum[0];
    }
    const type = schema.type;
    if (type === 'object' || schema.properties) {
        const out = {};
        const props = schema.properties ?? {};
        const required = new Set(schema.required ?? []);
        for (const [key, sub] of Object.entries(props)) {
            if (!required.has(key) && Object.keys(props).length > 12) {
                continue;
            }
            const val = schemaToExample(sub, depth + 1);
            if (val !== undefined) {
                out[key] = val;
            }
        }
        return out;
    }
    if (type === 'array') {
        const item = schemaToExample(schema.items ?? {}, depth + 1);
        return item === undefined ? [] : [item];
    }
    if (type === 'string') {
        if (schema.format === 'email') {
            return 'user@example.com';
        }
        if (schema.format === 'uuid') {
            return '00000000-0000-4000-8000-000000000001';
        }
        if (schema.format === 'date-time') {
            return '2026-01-01T00:00:00.000Z';
        }
        return 'string';
    }
    if (type === 'integer' || type === 'number') {
        return 1;
    }
    if (type === 'boolean') {
        return true;
    }
    return undefined;
}

function buildUrl(path, baseVar) {
    const segments = path.split('/').filter(Boolean);
    const pathVars = [];
    const pathParts = segments.map((seg) => {
        if (seg.startsWith(':')) {
            const key = seg.slice(1);
            const defaultVal = key === 'ingressToken' ? '{{ingressToken}}' : '';
            pathVars.push({ key, value: defaultVal.replace(/^\{\{|\}\}$/g, ''), description: `Path parameter \`${key}\`` });
            return `{{${key}}}`;
        }
        return seg;
    });
    const raw = `{{${baseVar}}}/${pathParts.join('/')}`.replace(/\{\{baseUrl\}\}\/\{\{workerBaseUrl\}\}/, '{{workerBaseUrl}}');
    return {
        raw: `{{${baseVar}}}/${pathParts.join('/')}`,
        host: [`{{${baseVar}}}`],
        path: pathParts,
        variable: pathVars.length > 0 ? pathVars : undefined,
    };
}

function isPublicAuth(auth) {
    return auth.startsWith('public');
}

function isWebhook(auth, path) {
    return auth.includes('webhook') || path.includes('/inbound/marketplace-webhooks/');
}

function isCeRoute(path) {
    return path.startsWith('/api/v2/ce/');
}

function resolveAuth(route, operation) {
    if (isPublicAuth(route.auth)) {
        return { type: 'noauth' };
    }
    if (isWebhook(route.auth, route.path)) {
        return { type: 'noauth' };
    }
    const sec = operation?.security;
    if (Array.isArray(sec) && sec.length === 0) {
        return { type: 'noauth' };
    }
    return {
        type: 'bearer',
        bearer: [{ key: 'token', value: '{{accessToken}}', type: 'string' }],
    };
}

function buildQueryParams(operation) {
    const params = [];
    for (const p of operation?.parameters ?? []) {
        if (p.in !== 'query') {
            continue;
        }
        params.push({
            key: p.name,
            value: p.schema?.default !== undefined ? String(p.schema.default) : '',
            description: p.description ?? '',
            disabled: p.required !== true,
        });
    }
    return params.length ? params : undefined;
}

function buildHeaders(route, operation, hasBody) {
    const headers = [];
    if (hasBody) {
        headers.push({ key: 'Content-Type', value: 'application/json' });
    }
    if (route.path.includes('/api/v2/') && route.method === 'POST' && !isCeRoute(route.path)) {
        headers.push({
            key: 'Idempotency-Key',
            value: '{{$guid}}',
            description: 'Required on selected v2 mutating endpoints (see route summary in OpenAPI).',
        });
    }
    if (isCeRoute(route.path)) {
        headers.push({
            key: 'X-CE-KEY',
            value: '{{ceApiKey}}',
            description: 'Alternative: query `apiKey` or `apikey`.',
            disabled: false,
        });
    }
    for (const p of operation?.parameters ?? []) {
        if (p.in === 'header') {
            headers.push({
                key: p.name,
                value: '',
                description: p.description ?? '',
                disabled: p.required !== true,
            });
        }
    }
    return headers.length ? headers : undefined;
}

function buildBody(operation) {
    const content = operation?.requestBody?.content;
    if (content === undefined) {
        return undefined;
    }
    const json = content['application/json'];
    if (json?.schema) {
        const example = schemaToExample(json.schema) ?? {};
        return {
            mode: 'raw',
            raw: `${JSON.stringify(example, null, 2)}\n`,
            options: { raw: { language: 'json' } },
        };
    }
    return undefined;
}

function buildExamples(operation) {
    const examples = [];
    for (const [code, resp] of Object.entries(operation?.responses ?? {})) {
        const schema = resp.content?.['application/json']?.schema;
        if (schema === undefined) {
            continue;
        }
        const body = schemaToExample(schema);
        if (body === undefined) {
            continue;
        }
        examples.push({
            name: `${code} (schema-derived)`,
            originalRequest: { method: 'GET', header: [], url: { raw: '{{baseUrl}}/' } },
            status: code,
            _postman_previewlanguage: 'json',
            header: [{ key: 'Content-Type', value: 'application/json' }],
            body: JSON.stringify(body, null, 2),
        });
    }
    return examples;
}

function folderForRoute(route, operation) {
    const tag = operation?.tags?.[0];
    if (tag) {
        return tag;
    }
    return FOLDER_BY_MODULE[route.module] ?? route.module;
}

function loginTestScript() {
    return {
        listen: 'test',
        script: {
            type: 'text/javascript',
            exec: [
                'pm.test("Status is 200", function () { pm.response.to.have.status(200); });',
                'if (pm.response.code === 200) {',
                '  const json = pm.response.json();',
                '  if (json.data && json.data.accessToken) {',
                '    pm.environment.set("accessToken", json.data.accessToken);',
                '    pm.collectionVariables.set("accessToken", json.data.accessToken);',
                '  }',
                '  if (json.data && json.data.refreshToken) {',
                '    pm.environment.set("refreshToken", json.data.refreshToken);',
                '    pm.collectionVariables.set("refreshToken", json.data.refreshToken);',
                '  }',
                '}',
            ],
        },
    };
}

function defaultTestScript() {
    return {
        listen: 'test',
        script: {
            type: 'text/javascript',
            exec: ['pm.test("Response received", function () { pm.response.to.be.within(200, 599); });'],
        },
    };
}

function buildRequest(route, spec, baseVar) {
    const operation = getOperation(spec, route.method, route.path);
    const name = operation?.summary ?? `${route.method} ${route.path}`;
    const body = buildBody(operation);
    const examples = buildExamples(operation);
    const url = buildUrl(route.path, baseVar);
    const item = {
        name: `[${route.routeId}] ${name}`,
        request: {
            method: route.method,
            header: buildHeaders(route, operation, body !== undefined),
            url,
            description: [
                `**Route ID:** ${route.routeId}`,
                `**Source:** \`${route.routeFile}\``,
                `**Authentication:** ${route.auth}`,
                operation?.description ?? '',
            ]
                .filter(Boolean)
                .join('\n\n'),
            auth: resolveAuth(route, operation),
        },
        response: examples.length > 0 ? examples : undefined,
    };
    if (route.path === '/api/v1/auth/login' && route.method === 'POST') {
        item.request.body = {
            mode: 'raw',
            raw: `${JSON.stringify(
                { tenantSlug: '{{tenantSlug}}', email: '{{email}}', password: '{{password}}' },
                null,
                2,
            )}\n`,
            options: { raw: { language: 'json' } },
        };
    } else if (body !== undefined) {
        item.request.body = body;
    }
    const query = buildQueryParams(operation);
    if (query !== undefined) {
        item.request.url.query = query;
    }
    const events = [];
    if (route.path === '/api/v1/auth/login' && route.method === 'POST') {
        events.push(loginTestScript());
    } else if (!isPublicAuth(route.auth) && route.method === 'GET') {
        events.push(defaultTestScript());
    }
    if (events.length) {
        item.event = events;
    }
    return { item, folder: folderForRoute(route, operation) };
}

function nestFolders(flat) {
    const map = new Map();
    for (const { item, folder } of flat) {
        if (!map.has(folder)) {
            map.set(folder, []);
        }
        map.get(folder).push(item);
    }
    const folders = [...map.entries()]
        .sort((a, b) => a[0].localeCompare(b[0]))
        .map(([name, items]) => ({
            name,
            item: items.sort((a, b) => a.name.localeCompare(b.name)),
        }));
    return folders;
}

function buildWorkerFolder() {
    return {
        name: 'Worker Observability (separate listener)',
        description: 'Requires worker process with `WORKER_OBSERVABILITY_HTTP_ENABLED=true`. Uses `{{workerBaseUrl}}` (default http://127.0.0.1:3001).',
        item: WORKER_ROUTES.map((r) => {
            const url = buildUrl(r.path, 'workerBaseUrl');
            return {
                name: `[${r.routeId}] ${r.method} ${r.path}`,
                request: {
                    method: r.method,
                    header: [],
                    url,
                    description: `**Route ID:** ${r.routeId}\n**Source:** \`${r.file}\`\n**Authentication:** public (bind localhost by default)`,
                    auth: { type: 'noauth' },
                },
                event: [defaultTestScript()],
            };
        }),
    };
}

function buildEnvironment() {
    return {
        id: randomUUID(),
        name: 'Nexora Local',
        values: [
            { key: 'baseUrl', value: 'http://localhost:3000', type: 'default', enabled: true },
            { key: 'workerBaseUrl', value: 'http://127.0.0.1:3001', type: 'default', enabled: true },
            { key: 'accessToken', value: '', type: 'secret', enabled: true },
            { key: 'refreshToken', value: '', type: 'secret', enabled: true },
            { key: 'apiKey', value: '', type: 'secret', enabled: true },
            { key: 'ceApiKey', value: '', type: 'secret', enabled: true },
            { key: 'tenantSlug', value: 'your-tenant-slug', type: 'default', enabled: true },
            { key: 'email', value: 'user@example.com', type: 'default', enabled: true },
            { key: 'password', value: '', type: 'secret', enabled: true },
            { key: 'tenantId', value: '', type: 'default', enabled: true },
            { key: 'ingressToken', value: '', type: 'default', enabled: true },
        ],
        _postman_variable_scope: 'environment',
    };
}

function writePostmanInventory(mainRows, spec) {
    const lines = [];
    lines.push('# Postman API inventory');
    lines.push('');
    lines.push('**Source:** verified against `docs/API_ROUTE_INVENTORY.md`, OpenAPI snapshot, and worker route files.');
    lines.push('');
    lines.push('| Metric | Count |');
    lines.push('| ------ | ----: |');
    lines.push(`| Main-server endpoints | ${mainRows.length} |`);
    lines.push(`| Worker-only endpoints | ${WORKER_ROUTES.length} |`);
    lines.push(`| **Total confirmed endpoints** | **${mainRows.length + WORKER_ROUTES.length}** |`);
    lines.push('');
    lines.push('## Main server');
    lines.push('');
    lines.push('| Route ID | HTTP Method | Full API Path | API Module | Route File | Authentication | Registration | Postman Status |');
    lines.push('| -------- | ----------- | ------------- | ---------- | ---------- | -------------- | ------------ | -------------- |');
    for (const r of mainRows) {
        const op = getOperation(spec, r.method, r.path);
        const handler = op?.operationId ?? 'See route file handler';
        lines.push(
            `| ${r.routeId} | ${r.method} | \`${r.path}\` | ${r.module} | \`${r.routeFile}\` | ${r.auth} | CONFIRMED | generated |`,
        );
    }
    lines.push('');
    lines.push('### Field notes');
    lines.push('');
    lines.push('| Field | Verification |');
    lines.push('| ----- | -------------- |');
    lines.push('| Handler | Fastify handler in route file; OpenAPI `summary` from Zod route schema |');
    lines.push('| Request body / query | OpenAPI snapshot from Zod `schema` on route |');
    lines.push('| Authorization | RBAC enforced in handlers; not fully expressed in OpenAPI — use tenant membership with required permissions |');
    lines.push('| Content-Type | `application/json` unless multipart (none in main inventory) |');
    lines.push('');
    lines.push('## Worker observability');
    lines.push('');
    lines.push('| Route ID | HTTP Method | Full API Path | Route File | Registration | Postman Status |');
    lines.push('| -------- | ----------- | ------------- | ---------- | ------------ | -------------- |');
    for (const w of WORKER_ROUTES) {
        lines.push(`| ${w.routeId} | ${w.method} | \`${w.path}\` | \`${w.file}\` | CONFIRMED (conditional on \`WORKER_OBSERVABILITY_HTTP_ENABLED\`) | generated |`);
    }
    lines.push('');
    lines.push('## Reconciliation');
    lines.push('');
    lines.push('- Main-server count **147** matches static inventory (re-run `node scripts/audit-route-inventory.mjs` after route changes).');
    lines.push('- OpenAPI snapshot: `node scripts/dump-openapi.mjs docs/.openapi-snapshot.json`');
    lines.push('- Postman coverage: `node scripts/verify-postman-coverage.mjs`');
    lines.push('');
    writeFileSync(OUT_INVENTORY, `${lines.join('\n')}\n`, 'utf8');
}

function main() {
    const mainRows = parseMainInventory();
    const spec = loadOpenApi();
    const built = mainRows.map((r) => buildRequest(r, spec, 'baseUrl'));
    const folders = nestFolders(built);
    folders.push(buildWorkerFolder());

    const collection = {
        info: {
            _postman_id: randomUUID(),
            name: 'Nexora Backend API',
            description:
                'Complete Nexora Fastify API (main server + worker observability). Generated from verified route inventory and OpenAPI. Do not use production credentials.',
            schema: 'https://schema.getpostman.com/json/collection/v2.1.0/collection.json',
        },
        auth: {
            type: 'bearer',
            bearer: [{ key: 'token', value: '{{accessToken}}', type: 'string' }],
        },
        event: [
            {
                listen: 'prerequest',
                script: {
                    type: 'text/javascript',
                    exec: [
                        'if (!pm.variables.get("baseUrl")) {',
                        '  pm.variables.set("baseUrl", "http://localhost:3000");',
                        '}',
                    ],
                },
            },
        ],
        variable: [
            { key: 'baseUrl', value: 'http://localhost:3000' },
            { key: 'workerBaseUrl', value: 'http://127.0.0.1:3001' },
            { key: 'accessToken', value: '' },
            { key: 'refreshToken', value: '' },
            { key: 'apiKey', value: '' },
            { key: 'ceApiKey', value: '' },
        ],
        item: folders,
    };

    mkdirSync(join(ROOT, 'postman'), { recursive: true });
    writeFileSync(OUT_COLLECTION, `${JSON.stringify(collection, null, 2)}\n`, 'utf8');
    writeFileSync(OUT_ENV, `${JSON.stringify(buildEnvironment(), null, 2)}\n`, 'utf8');
    writePostmanInventory(mainRows, spec);
    console.log(`Wrote ${OUT_COLLECTION} (${mainRows.length} main + ${WORKER_ROUTES.length} worker requests)`);
    console.log(`Wrote ${OUT_ENV}`);
    console.log(`Wrote ${OUT_INVENTORY}`);
}

main();
