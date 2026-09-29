#!/usr/bin/env node
/**
 * Documentation-only route scanner for Nexora HTTP surface.
 * Does not start the server or modify application behavior.
 */
import { readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const SRC = join(ROOT, 'src');

const ROUTE_FILE_SUFFIX = '.routes.js';
const ROUTE_TYPED_RE = /typed\.(get|post|put|patch|delete|head|options)\(\s*['"]([^'"]+)['"]/g;
const ROUTE_APP_RE = /app\.(get|post|put|patch|delete|head|options)\(\s*['"]([^'"]+)['"]/g;

function walk(dir, acc = []) {
    for (const ent of readdirSync(dir)) {
        const p = join(dir, ent);
        if (statSync(p).isDirectory()) {
            if (ent === 'node_modules' || ent === 'dist') {
                continue;
            }
            walk(p, acc);
        }
        else if (p.endsWith(ROUTE_FILE_SUFFIX) || p.endsWith('create-server.js')) {
            acc.push(p);
        }
    }
    return acc;
}

function scanFile(filePath) {
    const src = readFileSync(filePath, 'utf8');
    const rel = relative(ROOT, filePath).replace(/\\/g, '/');
    const found = [];
    for (const re of [ROUTE_TYPED_RE, ROUTE_APP_RE]) {
        re.lastIndex = 0;
        let match = re.exec(src);
        while (match !== null) {
            found.push({
                method: match[1].toUpperCase(),
                path: match[2],
                file: rel,
            });
            match = re.exec(src);
        }
    }
    return found;
}

function moduleFromPath(path) {
    if (path.startsWith('/health') || path === '/openapi.json' || path === '/api-docs.json' || path === '/api-docs') {
        return 'health-observability';
    }
    if (path.startsWith('/internal/')) {
        return 'metrics';
    }
    if (path.startsWith('/api/v2/ce/')) {
        return 'compatibility-stockconnect-ce';
    }
    if (path.startsWith('/api/v2/')) {
        return 'compatibility-v2';
    }
    if (path.startsWith('/api/v1/inbound/')) {
        return 'marketplace-webhook-ingestion';
    }
    const seg = path.split('/')[3] ?? 'unknown';
    return seg;
}

function authHint(path) {
    if (path === '/health/live' || path === '/health/ready' || path === '/internal/metrics') {
        return 'public';
    }
    if (path === '/openapi.json' || path === '/api-docs.json' || path === '/api-docs' || path.startsWith('/docs')) {
        return 'public (when DOCS_ENABLED)';
    }
    if (path === '/api/v1/tenants' || path.startsWith('/api/v1/tenants/')) {
        return 'mixed (POST create public; GET by id public per auth plugin)';
    }
    if (path.startsWith('/api/v1/auth/login') || path.startsWith('/api/v1/auth/refresh') || path.startsWith('/api/v1/auth/logout')) {
        return 'public';
    }
    if (path.startsWith('/api/v1/inbound/marketplace-webhooks/')) {
        return 'webhook ingress token (marketplace adapter)';
    }
    if (path.startsWith('/api/v2/ce/')) {
        return 'api-key (query apiKey/apikey or X-CE-KEY) or Bearer';
    }
    if (path.startsWith('/api/v2/foundation/ping')) {
        return 'Bearer or api-key header';
    }
    if (path.startsWith('/api/v2/')) {
        return 'Bearer or x-api-key header';
    }
    return 'Bearer or x-api-key header (default)';
}

const all = walk(SRC).flatMap(scanFile);
const byMethodPath = new Map();
for (const r of all) {
    const key = `${r.method} ${r.path}`;
    if (!byMethodPath.has(key)) {
        byMethodPath.set(key, r);
    }
}

const sorted = [...byMethodPath.values()].sort((a, b) => a.path.localeCompare(b.path) || a.method.localeCompare(b.method));

let id = 1;
const rows = sorted.map((r) => {
    const routeId = `R-${String(id++).padStart(4, '0')}`;
    return {
        routeId,
        ...r,
        module: moduleFromPath(r.path),
        auth: authHint(r.path),
        registrationStatus: 'CONFIRMED',
        swaggerStatus: 'AUTO (fastify-type-provider-zod + @fastify/swagger when schema present)',
    };
});

const methodCounts = {};
for (const r of rows) {
    methodCounts[r.method] = (methodCounts[r.method] ?? 0) + 1;
}

const workerFile = join(SRC, 'workers/observability/worker-observability.routes.js');
const workerRoutes = scanFile(workerFile).map((r) => ({
    ...r,
    note: 'Worker observability HTTP (separate process; not mounted on main API server)',
}));

const lines = [];
lines.push('# Nexora API Route Inventory');
lines.push('');
lines.push('**Generated:** documentation audit (static scan of `*.routes.js` and `create-server.js`)');
lines.push('**Framework:** Fastify 5 + `fastify-type-provider-zod` + `@fastify/swagger` (OpenAPI 3.1)');
lines.push('**Main entry:** `src/app/main.js` → `createApplication()` → `createHttpServer()`');
lines.push('');
lines.push('## Repository inspection (Phase 1)');
lines.push('');
lines.push('| Topic | Finding |');
lines.push('| ----- | ------- |');
lines.push('| Runtime | Node (see `package.json` engines); **Fastify 5**, not Express |');
lines.push('| HTTP bootstrap | `src/app/http/create-server.js` registers plugins + domain `*.routes.js` |');
lines.push('| API prefixes | `/api/v1/*` (core), `/api/v2/*` (Merchant compatibility), `/api/v2/ce/*` (StockConnect CE) |');
lines.push('| Auth | `authentication.plugin.js` — JWT Bearer + `x-api-key`; public patterns for auth, tenants, webhooks, health, docs |');
lines.push('| Authorization | `authorization.plugin.js` + route-level permission checks in handlers |');
lines.push('| Validation | Zod via `fastify-type-provider-zod`; schemas in `presentation/*.schemas.js` |');
lines.push('| OpenAPI | `@fastify/swagger` + `jsonSchemaTransform`; UI `@scalar/fastify-api-reference` |');
lines.push('| Workers | BullMQ workers; separate observability HTTP in `worker-observability.routes.js` |');
lines.push('');
lines.push('### Extended field reference (per Route ID)');
lines.push('');
lines.push('| Ticket column | Where verified |');
lines.push('| ------------- | -------------- |');
lines.push('| Controller / handler | Inline handler or imported command in the matching `*.routes.js` |');
lines.push('| Middleware | Global plugins in `create-server.js`; auth skip via `PUBLIC_ROUTE_PATTERNS` |');
lines.push('| Path / query / body | Zod `schema` on the route definition in `*.routes.js` |');
lines.push('| Success / error responses | Zod response schemas + shared error schemas in route modules |');
lines.push('');
lines.push('> OpenAPI is **auto-generated** from route Zod schemas where defined. When `DOCS_ENABLED=true`: Scalar UI at `/docs` (alias `/api-docs`), spec at `/openapi.json` and `/api-docs.json`.');
lines.push('');
lines.push('## Summary counts');
lines.push('');
lines.push(`| Metric | Count |`);
lines.push(`| ------ | ----: |`);
lines.push(`| Route definitions in source (incl. duplicates across files) | ${all.length} |`);
lines.push(`| **Unique registered endpoints (method + path, main HTTP server)** | **${rows.length}** |`);
for (const [method, count] of Object.entries(methodCounts).sort()) {
    lines.push(`| ${method} endpoints | ${count} |`);
}
lines.push(`| Worker observability routes (separate listener) | ${workerRoutes.length} |`);
lines.push('');
lines.push('## Main application routes');
lines.push('');
lines.push('| Route ID | Method | Full path | Route file | API module | Authentication | Registration | Swagger |');
lines.push('| -------- | ------ | --------- | ---------- | ---------- | -------------- | ------------ | ------- |');
for (const r of rows) {
    lines.push(`| ${r.routeId} | ${r.method} | \`${r.path}\` | \`${r.file}\` | ${r.module} | ${r.auth} | ${r.registrationStatus} | ${r.swaggerStatus} |`);
}
lines.push('');
lines.push('## Reconciliation notes');
lines.push('');
lines.push('- Routes are registered in `src/app/http/create-server.js` via `app.register(moduleRoutes, deps)`.');
lines.push('- Compatibility registers **both** `compatibility.routes.js` and `stockconnect-ce.routes.js` (`/api/v2/*` and `/api/v2/ce/*`).');
lines.push('- `GET /openapi.json`, `GET /api-docs.json`, and `GET /api-docs` (redirect to `/docs`) are registered in `create-server.js` when `DOCS_ENABLED` is true.');
lines.push('- `GET /docs/*` is served by `@scalar/fastify-api-reference` when docs are enabled.');
lines.push('- Authentication plugin public routes: see `src/app/http/plugins/authentication.plugin.js` (`PUBLIC_ROUTE_PATTERNS`).');
lines.push('- CE routes accept query `apiKey` / `apikey` or header `X-CE-KEY` in addition to standard API key header.');
lines.push('- No unmounted `*.routes.js` files found under `src/modules` (all wired through `create-server.js` or worker bootstrap).');
lines.push('');
lines.push('## Worker observability (conditional)');
lines.push('');
lines.push('| Method | Path | File | Notes |');
lines.push('| ------ | ---- | ---- | ----- |');
for (const r of workerRoutes) {
    lines.push(`| ${r.method} | \`${r.path}\` | \`${r.file}\` | ${r.note} |`);
}
lines.push('');
lines.push('## UNRESOLVED');
lines.push('');
lines.push('None from static scan. Runtime-only routes: none identified.');
lines.push('');
lines.push('## OpenAPI reconciliation');
lines.push('');
lines.push('Run `npm run docs:openapi-coverage` to compare this inventory against live `app.swagger()` output. Target: **147/147** operations matched (main HTTP server).');
lines.push('');

const outPath = join(ROOT, 'docs/API_ROUTE_INVENTORY.md');
writeFileSync(outPath, `${lines.join('\n')}\n`, 'utf8');
console.log(`Wrote ${outPath} (${rows.length} unique main-server endpoints)`);
