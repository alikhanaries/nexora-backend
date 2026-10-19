#!/usr/bin/env node
/**
 * Documentation-only: assembles Wasl_Backend_Complete_Architecture_and_Technology_Guide.md
 */
import { readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '../..');
const OUT = join(dirname(fileURLToPath(import.meta.url)), 'Wasl_Backend_Complete_Architecture_and_Technology_Guide.md');

function walkDirs(base, maxDepth, depth = 0, prefix = '') {
  if (depth > maxDepth || !statSync(base, { throwIfNoEntry: false })?.isDirectory()) {
    return [];
  }
  const lines = [];
  const entries = readdirSync(base, { withFileTypes: true })
    .filter((e) => !['node_modules', '.git', 'dist'].includes(e.name))
    .sort((a, b) => a.name.localeCompare(b.name));
  for (let i = 0; i < entries.length; i += 1) {
    const ent = entries[i];
    const isLast = i === entries.length - 1;
    const branch = isLast ? '└── ' : '├── ';
    const childPrefix = isLast ? '    ' : '│   ';
    if (ent.isDirectory()) {
      lines.push(`${prefix}${branch}${ent.name}/`);
      lines.push(...walkDirs(join(base, ent.name), maxDepth, depth + 1, prefix + childPrefix));
    } else {
      lines.push(`${prefix}${branch}${ent.name}`);
    }
  }
  return lines;
}

function countAll() {
  let dirs = 0;
  let files = 0;
  function w(dir) {
    if (!statSync(dir, { throwIfNoEntry: false })?.isDirectory()) return;
    dirs += 1;
    for (const ent of readdirSync(dir, { withFileTypes: true })) {
      if (ent.name === 'node_modules' || ent.name === '.git') continue;
      const p = join(dir, ent.name);
      if (ent.isDirectory()) w(p);
      else files += 1;
    }
  }
  w(ROOT);
  return { dirs, files };
}

const domainModules = readdirSync(join(ROOT, 'src/modules'), { withFileTypes: true })
  .filter((d) => d.isDirectory())
  .map((d) => d.name)
  .sort();

const nestModules = readdirSync(join(ROOT, 'src/nest'), { withFileTypes: true })
  .filter((d) => d.isDirectory())
  .map((d) => d.name)
  .sort();

const migrationFiles = readdirSync(join(ROOT, 'src/infrastructure/postgres/migrations'))
  .filter((f) => f.endsWith('.sql'))
  .sort();

const inventoryCsv = readFileSync(
  join(dirname(fileURLToPath(import.meta.url)), 'Wasl_Backend_Source_File_Inventory.csv'),
  'utf8',
);
const inventoryRows = inventoryCsv.trim().split('\n').slice(1);
const srcCount = inventoryRows.filter((r) => r.startsWith('src/')).length;
const layerCounts = {};
for (const row of inventoryRows) {
  const layer = row.split(',')[1] ?? 'unknown';
  layerCounts[layer] = (layerCounts[layer] ?? 0) + 1;
}
const layerTable = Object.entries(layerCounts)
  .sort((a, b) => b[1] - a[1])
  .map(([layer, count]) => `| ${layer} | ${count} |`)
  .join('\n');

const endpointMd = readFileSync(
  join(dirname(fileURLToPath(import.meta.url)), 'Wasl_Backend_Nest_Endpoint_Inventory.md'),
  'utf8',
);
const endpointCount = (endpointMd.match(/\| (GET|POST|PUT|PATCH|DELETE) \|/g) ?? []).length;

const { dirs, files } = countAll();
const treeRoot = ['wasl-backend/'].concat(walkDirs(ROOT, 2)).join('\n');

const pkg = JSON.parse(readFileSync(join(ROOT, 'package.json'), 'utf8'));
const lock = JSON.parse(readFileSync(join(ROOT, 'package-lock.json'), 'utf8'));
function lockedVersion(name) {
  return lock.packages[`node_modules/${name}`]?.version ?? pkg.dependencies?.[name] ?? pkg.devDependencies?.[name] ?? '—';
}

const depRows = [...Object.keys(pkg.dependencies ?? {}), ...Object.keys(pkg.devDependencies ?? {})]
  .sort()
  .map((name) => {
    const cat = pkg.dependencies?.[name] ? 'runtime' : 'dev';
    return `| \`${name}\` | ${lockedVersion(name)} | ${cat} | See §3 Technology stack | \`src/\`, \`tests/\`, workers |`;
  })
  .join('\n');

const moduleSections = domainModules
  .map((name) => {
    const base = `src/modules/${name}`;
    const sub = readdirSync(join(ROOT, base), { withFileTypes: true })
      .filter((d) => d.isDirectory())
      .map((d) => d.name);
    const nestMatch = nestModules.find((n) => n.replace(/-/g, '') === name.replace(/-/g, '') || n === name);
    return `### ${name}

| Attribute | Detail |
| --------- | ------ |
| **Business purpose** | Domain logic for **${name}** (see \`${base}/application/\` use cases). |
| **Folder** | \`${base}/\` with typical layers: ${sub.map((s) => `\`${s}/\``).join(', ') || '_(flat)_'}. |
| **HTTP (Nest)** | ${nestMatch ? `\`src/nest/${nestMatch}/\` Nest module + controller(s).` : 'No dedicated Nest folder; may be wired via compatibility or worker paths.'} |
| **Factory** | \`create${name.split('-').map((p) => p[0].toUpperCase() + p.slice(1)).join('')}Module\` or \`index.js\` export in \`${base}/\`. |
| **Persistence** | PostgreSQL repositories under \`${base}/infrastructure/\` where present. |
| **Tests** | \`tests/unit/**/${name}*\`, \`tests/integration/**/${name}*\` (search by module name). |

**How it fits:** Domain modules are composed in \`src/app/bootstrap/create-application.js\` and injected into Nest via \`CoreDomainModule\` (\`src/nest/domain/\`). Controllers call thin Nest services that delegate to domain query/command services.
`;
  })
  .join('\n');

const md = `# Wasl Backend — Complete Architecture and Technology Guide

**Document classification:** Internal engineering reference  
**Repository:** \`wasl-backend\` (JavaScript ESM, Node.js ≥ 24)  
**Generated:** ${new Date().toISOString().slice(0, 10)}  
**Scope:** Architecture, folder structure, technology stack, request flows, business modules, API inventory, configuration, database, queues, integrations, testing, operations, risks.

---

## Document purpose and scope

This guide describes the **actual** Wasl backend as implemented in this repository. It is intended for engineers onboarding from beginner to advanced level: what each major folder does, how NestJS and domain modules interact, and how HTTP requests, database access, queues, and webhooks flow through the system.

**Companion artifacts (full machine-readable inventories):**

| File | Contents |
| ---- | -------- |
| [Wasl_Backend_Source_File_Inventory.csv](./Wasl_Backend_Source_File_Inventory.csv) | Every \`.js\` / \`.mjs\` / \`.cjs\` under \`src/\`, \`tests/\`, \`test/\`, \`scripts/\` with a **layer** tag |
| [Wasl_Backend_Nest_Endpoint_Inventory.md](./Wasl_Backend_Nest_Endpoint_Inventory.md) | **${endpointCount}** HTTP routes from Nest \`@Get/@Post/...\` decorators |
| [Wasl_Backend_Environment_Variables.md](./Wasl_Backend_Environment_Variables.md) | Environment keys from \`src/app/config/schema.js\` |

**Excluded from source inventory:** \`node_modules/\`, build output, secrets in \`.env\`, and generated lockfile trees. **${srcCount}** application-related source paths are listed in the CSV.

**Verification note:** Runtime behavior described here is derived from static analysis of source and configuration unless explicitly marked as execution-verified.

---

## Table of contents

1. [Repository overview](#1-repository-overview)
2. [Folder tree and layering](#2-folder-tree-and-layering)
3. [Technology stack](#3-technology-stack)
4. [NestJS and Express architecture](#4-nestjs-and-express-architecture)
5. [Request and job lifecycles](#5-request-and-job-lifecycles)
6. [Business modules](#6-business-modules)
7. [API endpoint reference](#7-api-endpoint-reference)
8. [Configuration and environment](#8-configuration-and-environment)
9. [Database structure](#9-database-structure)
10. [Testing and developer workflow](#10-testing-and-developer-workflow)
11. [Deployment and infrastructure](#11-deployment-and-infrastructure)
12. [Dependency and architecture map](#12-dependency-and-architecture-map)
13. [Architecture risks and documentation gaps](#13-architecture-risks-and-documentation-gaps)
14. [Glossary](#14-glossary)
15. [Coverage appendix](#15-coverage-appendix)

---

## 1. Repository overview

### 1.1 What Wasl backend is

Wasl is a **multi-tenant commerce and channel management platform**. The backend exposes REST APIs for tenants, products, inventory, channels, marketplaces, orders, fulfillment (shipments, cancellations, returns), webhooks, audit, authorization, and **merchant compatibility** layers (ChannelEngine-style and StockConnect integration paths).

### 1.2 Architectural style

The codebase follows a **modular monolith** (see \`docs/decisions/ADR-001-modular-monolith.md\`):

- **Domain modules** under \`src/modules/*\` — use cases, repositories, Zod schemas, legacy Fastify-style route modules (still present for wiring/tests in places).
- **HTTP adapter** under \`src/nest/*\` — NestJS 11 controllers/services on **Express** (\`@nestjs/platform-express\`).
- **Composition root** — \`src/app/bootstrap/create-application.js\` wires domain modules and passes a \`coreDomain\` object into Nest.
- **Infrastructure** — \`src/infrastructure/*\` (Postgres, Redis, BullMQ, S3, HTTP client, auth primitives).
- **Workers** — separate process \`src/workers/main.js\` consuming BullMQ jobs (catalog sync, marketplace lifecycle, webhook delivery, etc.).

### 1.3 Process model

| Process | Entry | Role |
| ------- | ----- | ---- |
| API | \`src/app/main.js\` | Loads config → infrastructure → \`createApplication()\` → Nest HTTP listen |
| Worker | \`src/workers/main.js\` | Same config/infra pattern; registers queue handlers + optional observability HTTP |
| Migrations CLI | \`src/app/bootstrap/migrate-cli.js\` | Applies SQL in \`src/infrastructure/postgres/migrations/\` |
| Standalone Nest bootstrap | \`src/nest/bootstrap.mjs\` | Alternate dev entry (\`npm run dev:nest\`); production path uses \`main.js\` |

### 1.4 Repository statistics (scan)

| Metric | Count |
| ------ | ----- |
| Directories (excluding \`node_modules\`, \`.git\`) | ${dirs} |
| Files (same exclusion) | ${files} |
| \`src/**/*.js\` in inventory | ${srcCount} |
| SQL migrations | ${migrationFiles.length} |
| Domain modules (\`src/modules/\`) | ${domainModules.length} |
| Nest feature areas (\`src/nest/\`) | ${nestModules.length} |
| Nest decorator routes (static scan) | ${endpointCount} |
| Declared npm dependencies reviewed | ${Object.keys(pkg.dependencies ?? {}).length + Object.keys(pkg.devDependencies ?? {}).length} |

---

## 2. Folder tree and layering

### 2.1 Top-level tree (depth ≤ 2)

\`\`\`text
${treeRoot}
\`\`\`

### 2.2 \`src/app/\` — application bootstrap and cross-cutting

| Path | Purpose |
| ---- | ------- |
| \`src/app/main.js\` | API process entry: config, infra, \`createApplication\`, outbox publisher, pool metrics, graceful shutdown. |
| \`src/app/bootstrap/create-application.js\` | **Composition root**: instantiates all domain modules, marketplace adapters, compatibility, webhooks; returns \`httpServer\` via \`createNestHttpServer\`. |
| \`src/app/bootstrap/create-infrastructure.js\` | Database pool, Redis, BullMQ queue, S3 storage, logger, metrics, tracing, rate limiter, outbox. |
| \`src/app/bootstrap/shutdown.js\` | Ordered teardown: readiness, HTTP, outbox, queue, Redis, DB, tracing. |
| \`src/app/config/schema.js\` | Zod schema — **single source of truth** for environment variables. |
| \`src/app/config/config.js\` | Maps validated env to nested \`config\` object consumed by modules. |
| \`src/app/http/create-nest-http-server.js\` | Creates Nest app; exposes \`inject()\` for Vitest integration tests (Supertest). |
| \`src/app/observability/readiness.js\` | Readiness probes (DB, Redis, queue, storage). |
| \`src/app/register-swc.mjs\` | SWC register hook for Nest decorators when running \`main.js\`. |

**Why it exists:** Keeps framework (Nest) at the edge while preserving a explicit, testable domain wiring layer independent of HTTP.

### 2.3 \`src/modules/\` — domain bounded contexts

Each module typically contains:

- \`application/\` — use cases and domain services (plain classes/functions).
- \`infrastructure/\` — Postgres repositories, adapters.
- \`presentation/\` — Zod schemas and legacy \`*.routes.js\` (Fastify-era route registration; **HTTP is now primarily Nest**).
- \`index.js\` — \`createXModule(deps)\` factory exporting services for composition root.

**Used by:** \`create-application.js\`, workers, and Nest services via \`CORE_DOMAIN\` injection token.

### 2.4 \`src/nest/\` — HTTP adapter (NestJS + Express)

| Area | Responsibility |
| ---- | -------------- |
| \`bootstrap/create-nest-application.js\` | \`NestFactory.create\` with \`ExpressAdapter\`, Helmet/body limits via \`configure-express.js\`. |
| \`app.module.js\` | Dynamic \`buildAppModule(infra, coreDomain)\` — registers feature modules and global \`AuthGuard\` + \`GlobalExceptionFilter\`. |
| \`domain/core-domain.module.js\` | Provides \`CORE_DOMAIN\` token with wired use cases. |
| \`common/guards/auth.guard.js\` | JWT, API key (\`X-Api-Key\`, \`ApiKey\`), merchant compat query keys, StockConnect Bearer \`nxk_\` keys. |
| \`common/filters/global-exception.filter.js\` | Maps domain errors to HTTP responses. |
| \`*/*.controller.js\` | Route handlers — see endpoint inventory. |
| \`stock-connect-integration/\` | \`/api/v2/stock-connect/*\` integration API (when enabled). |
| \`legacy-compatibility/\`, \`legacy-orders/\` | ChannelEngine / v1 compatibility surfaces. |

### 2.5 \`src/infrastructure/\`

PostgreSQL (\`pg\`), migrations, outbox/inbox, Redis (\`ioredis\`), BullMQ queue worker runtime, S3 client, fetch HTTP client, JWT (jose), argon2, AES encryptor, OpenTelemetry hooks.

### 2.6 \`src/workers/\`

Queue consumer process: \`handlers/queue-job-handlers.js\`, marketplace lifecycle wiring, catalog sync, webhook delivery, integration event consumers.

### 2.7 \`src/shared/\` and \`src/integrations/\`

Cross-cutting utilities (errors, context, auth route prefixes). \`src/integrations/stock-connect/\` holds StockConnect DTO mappers/schemas separate from Nest controllers.

### 2.8 \`tests/\`, \`test/\`, \`scripts/\`

| Path | Role |
| ---- | ---- |
| \`tests/unit/\` | Vitest unit tests (no external services). |
| \`tests/integration/\` | Vitest + real Postgres/Redis/MinIO; uses Nest \`inject\`. |
| \`test/nest/\` | Jest tests focused on Nest controllers/guards. |
| \`scripts/check-syntax.mjs\` | \`npm run build\` — parses all \`src/**/*.js\` (skips \`src/nest\` per config). |
| \`scripts/audit-route-inventory.mjs\` | **Legacy** Fastify route scan — can disagree with Nest inventory. |

### 2.9 Repository root files (non-\`src/\`)

| Path | Purpose |
| ---- | ------- |
| \`package.json\` | ESM package manifest, Node ≥ 24, npm scripts for API/worker/tests/migrations. |
| \`package-lock.json\` | Locked dependency versions (see §3). |
| \`vitest.config.js\` | Unit vs integration Vitest projects; SWC for Nest in integration tests. |
| \`jest.config.js\` | Nest Jest suite under \`test/nest/\`. |
| \`eslint.config.js\` | ESLint flat config; **ignores** \`src/nest/**\` for SWC decorator syntax. |
| \`.dependency-cruiser.cjs\` | Module boundary rules (\`npm run arch:check\`). |
| \`Dockerfile\` | Multi-stage Node 24 Alpine image; default CMD \`node src/app/main.js\`; worker override documented in comments. |
| \`docker-compose.yml\` | Local Postgres, Redis (BullMQ-safe), MinIO; optional observability profile. |
| \`.env.example\` | Safe template for required env vars (no production secrets). |
| \`docs/\` | ADRs, migration notes, Postman/Swagger reports, this architecture guide. |
| \`infrastructure/observability/\` | OTel collector and Prometheus configs for compose profile. |

### 2.10 Per-file inventory policy

Documenting **${srcCount}** files inline would reduce readability. The CSV inventory lists **every** source path with layer:

- \`nest-http\`, \`domain-module\`, \`application-bootstrap\`, \`infrastructure\`, \`workers\`, \`shared\`, \`integrations\`, \`vitest\`, \`jest-nest\`, \`scripts\`.

For any path \`src/modules/<module>/application/<use-case>.js\`, expect a single use case class/function invoked from the module factory or Nest service.

**Inventory rows by layer (\`${inventoryRows.length}\` total paths in CSV):**

| Layer | File count |
| ----- | ------------ |
${layerTable}

**Typical file roles within a domain module:**

| Subfolder | Example | Responsibility |
| --------- | ------- | ---------------- |
| \`application/\` | \`list-orders.js\` | Orchestrates authorization + repository calls for one operation. |
| \`infrastructure/\` | \`postgres-order-repository.js\` | SQL queries; maps rows to domain types. |
| \`presentation/\` | \`order.schemas.js\` | Zod request/response contracts shared by Nest and legacy routes. |
| \`presentation/\` | \`order.routes.js\` | Legacy route registration (Fastify-era); not the primary HTTP surface. |
| \`domain/\` | entity/value objects | Invariants and pure logic where extracted. |

---

## 3. Technology stack

### 3.1 Master dependency table

| Technology/package | Verified version | Category | Why we use it | Actual usage locations |
| ------------------ | ---------------- | -------- | ------------- | ---------------------- |
${depRows}

### 3.2 Core runtime and framework

- **Node.js** ≥ 24 (\`package.json#engines\`) — native \`--env-file\`, ESM (\`"type": "module"\`).
- **NestJS 11** — modules, guards, filters, DI for HTTP layer only.
- **Express 4** — underlying HTTP server via \`ExpressAdapter\`; custom body parsing in \`configure-express.js\`.
- **SWC** — decorator compilation for Nest in runtime (\`register-swc.mjs\`) and Vitest (\`unplugin-swc\`).

### 3.3 Data, queues, storage

- **PostgreSQL 17** (Docker image) — primary store; RLS migrations (\`0030_rls_hardening.sql\`).
- **Redis 7** — caching, locks, rate limits; **BullMQ** requires \`noeviction\` (see \`docker-compose.yml\`).
- **MinIO (S3-compatible)** — object storage via \`@aws-sdk/client-s3\`.
- **BullMQ** — \`src/infrastructure/queue/bullmq-job-queue.js\`, \`bullmq-worker-runtime.js\`.

### 3.4 Security and auth

- **jose** — JWT access tokens (\`src/infrastructure/auth/jose-access-token-service.js\`).
- **argon2** — password hashing.
- **otplib** — MFA TOTP.
- **helmet** — HTTP security headers on Express.
- **Zod** — config and request schema validation.

### 3.5 Observability

- **pino** — structured logging.
- **prom-client** — metrics endpoint (when enabled).
- **OpenTelemetry** — optional tracing (\`TRACING_ENABLED\`, OTLP exporter).

### 3.6 Testing and quality

- **Vitest 3** — primary test runner (unit + integration projects).
- **Jest 29** — Nest-focused tests under \`test/nest/\`.
- **Supertest** — HTTP assertions via \`inject\` wrapper.
- **ESLint 9 + Prettier + dependency-cruiser** — \`npm run verify\`.

### 3.7 Apparently unused or dev-only

- **dotenv** — devDependency; runtime prefers \`--env-file=.env\`.
- Packages listed but with **no** \`src/\` import should be treated as transitive or tooling-only until grep confirms (see risks §13).

---

## 4. NestJS and Express architecture

### 4.1 Bootstrap sequence

\`\`\`mermaid
sequenceDiagram
  participant Main as main.js
  participant Config as loadConfigFromEnvironment
  participant Infra as createInfrastructure
  participant App as createApplication
  participant Nest as createNestHttpServer
  participant Listen as httpServer.listen

  Main->>Config: schema.js Zod parse
  Main->>Infra: DB, Redis, queue, S3, logger
  Main->>App: wire domain modules
  App->>Nest: coreDomain + infra
  Nest->>Nest: NestFactory + ExpressAdapter
  Main->>Listen: SERVER_HOST/SERVER_PORT
\`\`\`

**Key files:** \`src/app/main.js\`, \`src/app/bootstrap/create-application.js\`, \`src/nest/bootstrap/create-nest-application.js\`, \`src/nest/app.module.js\`.

### 4.2 Module registration

When \`coreDomain !== null\`, \`buildAppModule\` registers (among others): Auth, Tenants, Authorization, Audit, ApiKeys, MFA, Products, Pricing, Offers, Inventory, Channels, Marketplaces, Webhooks, WebhookSubscriptions, Orders, Cancellations, Shipments, Returns, LegacyOrders, LegacyCompatibility, StockConnectIntegration.

Global providers:

- \`APP_FILTER\` → \`GlobalExceptionFilter\`
- \`APP_GUARD\` → \`AuthGuard\` (skipped when \`coreDomain\` is null — e.g. minimal health-only boot)

### 4.3 Framework vs domain

| Layer | Location | Responsibility |
| ----- | -------- | -------------- |
| HTTP routing / status codes | \`src/nest/**/*.controller.js\` | Map HTTP to service calls |
| Authorization enforcement | \`AuthGuard\` + domain \`AuthorizationService\` | Authentication at edge; permission checks in use cases |
| Business rules | \`src/modules/*/application/*\` | Pure domain logic |
| Persistence | \`src/modules/*/infrastructure/*\` | SQL via \`pg\` |

### 4.4 Fastify migration status

**Verified:** Production API uses **Nest + Express** (\`create-nest-http-server.js\`). There is **no** active Fastify server factory in the runtime path described above. Legacy \`*.routes.js\` files under \`src/modules/*/presentation/\` remain for historical wiring and tooling; \`scripts/audit-route-inventory.mjs\` still scans them — treat \`docs/API_ROUTE_INVENTORY.md\` as **stale** relative to Nest.

---

## 5. Request and job lifecycles

### 5.1 HTTP request (authenticated API)

\`\`\`mermaid
flowchart TD
  A[Client HTTP request] --> B[Express middleware configureExpress]
  B --> C[Nest routing]
  C --> D{AuthGuard}
  D -->|Public route| E[Controller]
  D -->|JWT| F[authenticateAccessToken]
  D -->|API key| G[authenticateApiKey]
  F --> H[enrichRequestContext tenant + user]
  G --> H
  H --> E
  E --> I[Nest Service]
  I --> J[Domain use case]
  J --> K[(PostgreSQL)]
  J --> L[Event recorder / outbox]
  E --> M[GlobalExceptionFilter on error]
\`\`\`

**Files:** \`src/nest/common/guards/auth.guard.js\`, \`src/modules/identity/application/authenticate-access-token.js\`, \`src/shared/context/request-context.js\`, controllers/services under \`src/nest/<feature>/\`.

### 5.2 Database read/write

Domain repositories use a shared \`database\` / \`queryable\` abstraction from infrastructure. Tenant context is set for RLS (see migrations \`0001_app_schema_and_tenant_context.sql\`, \`0030_rls_hardening.sql\`). Transactions are coordinated at use-case level where needed.

### 5.3 BullMQ job flow

\`\`\`mermaid
sequenceDiagram
  participant API as API / outbox
  participant Q as bullmq-job-queue
  participant R as Redis
  participant W as workers/main.js
  participant H as queue-job-handlers

  API->>Q: addJob(name, payload)
  Q->>R: persist job
  W->>H: worker consumes
  H->>H: handler by job name
  alt success
    H->>R: complete
  else failure
    H->>R: retry with backoff
  end
\`\`\`

Configuration: \`QUEUE_*\`, \`QUEUE_REDIS_URL\` (optional override), \`QUEUE_DEFAULT_ATTEMPTS\`, \`QUEUE_BACKOFF_BASE_MS\` in \`schema.js\`.

### 5.4 Marketplace webhook ingress (high level)

Inbound routes live under Nest \`webhooks\` / marketplace modules and domain \`marketplace-webhook-ingestion\`. Typical flow: verify signature → normalize payload (Zod) → idempotency/inbox → enqueue processing. See \`docs/marketplaces/webhook-ingestion.md\` for operational detail aligned with code.

### 5.5 Outbound webhooks

Worker \`webhookDeliveryService\` loads subscriptions, signs payloads, delivers via \`infra.httpClient\`, records deliveries in Postgres, respects retry/\`Retry-After\` settings (\`WEBHOOK_DELIVERY_*\` env vars).

### 5.6 Health and readiness

\`src/nest/health/health.controller.js\` exposes health/readiness endpoints (see Nest inventory). \`ReadinessService\` aggregates probe results from infrastructure components.

### 5.7 Application startup (outbox and metrics)

After \`createApplication\` resolves, \`main.js\` starts \`infra.outboxPublisher\` and periodic database pool metrics before listening. On SIGTERM/SIGINT, \`gracefulShutdown\` drains HTTP, stops outbox/queue consumers, closes Redis and DB pools — see \`src/app/bootstrap/shutdown.js\`.

\`\`\`mermaid
flowchart LR
  subgraph Startup
    M[main.js]
    O[outboxPublisher.start]
    P[pool metrics interval]
    L[httpServer.listen]
  end
  M --> O --> P --> L
\`\`\`

---

## 6. Business modules

Domain modules discovered under \`src/modules/\`:

${moduleSections}

**Additional module-like areas (not separate top-level folders):**

- \`channel-catalog-sync\` — catalog sync jobs and reconciliation scheduler (worker-heavy).
- \`compatibility\` — ChannelEngine / merchant compat read models and routes.
- \`external-id-mapping\` — integer ID mappings for compat APIs.
- \`marketplace-order-ingestion\` / \`marketplace-webhook-ingestion\` — inbound marketplace pipelines.

---

## 7. API endpoint reference

The authoritative list for **current Nest registrations** is in [Wasl_Backend_Nest_Endpoint_Inventory.md](./Wasl_Backend_Nest_Endpoint_Inventory.md) (**${endpointCount}** routes).

**Discovery limitations:**

- Static regex scan may miss dynamically constructed paths or custom decorators.
- Global prefix (if any) is applied in Nest bootstrap — verify \`configure-express.js\` / \`setGlobalPrefix\` in \`create-nest-application.js\` when interpreting paths.
- Legacy \`docs/API_ROUTE_INVENTORY.md\` reflects Fastify-era scans (**not** authoritative post-migration).

**Authentication patterns (verify per route):**

- \`@Public()\` decorator or \`isPublicRoute\` — no auth.
- Default — \`AuthGuard\` requires JWT Bearer **or** API key headers.
- Merchant compat / StockConnect paths — additional rules in \`auth.guard.js\`.

---

## 8. Configuration and environment

All variables are declared in \`src/app/config/schema.js\` and loaded via \`loadConfigFromEnvironment()\`. Unknown keys are **ignored** (typo-safe deployments).

See [Wasl_Backend_Environment_Variables.md](./Wasl_Backend_Environment_Variables.md) for the complete name list.

| Source | Role |
| ------ | ---- |
| \`.env\` | Local secrets (never commit) |
| \`.env.example\` | Documented template without production secrets |
| \`docker-compose.yml\` | Local Postgres/Redis/MinIO defaults |
| \`--env-file=.env\` | Used by \`npm run dev/start\` scripts |

**Sensitive variables (non-exhaustive):** \`DATABASE_URL\`, \`AUTH_JWT_*\`, \`AUTH_MFA_ENCRYPTION_KEY\`, \`STORAGE_SECRET_ACCESS_KEY\`, API keys, marketplace connection secrets stored encrypted in DB.

**StockConnect integration:**

- \`STOCK_CONNECT_INTEGRATION_ENABLED\` — feature flag.
- \`STOCK_CONNECT_BASE_URL\`, \`STOCK_CONNECT_SERVICE_TOKEN\` — outbound/client configuration; **inbound** StockConnect API auth uses Wasl API keys (\`nxk_\` prefix), not the service token.

---

## 9. Database structure

### 9.1 Engine and migrations

- **Engine:** PostgreSQL.
- **Migrations:** \`${migrationFiles.length}\` files in \`src/infrastructure/postgres/migrations/\`, applied via \`npm run migrate\`.

### 9.2 Migration themes (chronological filenames)

| Migration range | Domain |
| ---------------- | ------ |
| 0001–0004 | Schema, outbox, inbox, idempotency |
| 0005–0010 | Tenants, users, roles, auth, MFA |
| 0011–0012 | Audit, marketplaces |
| 0013–0020 | Channels, products, inventory, pricing, offers, commerce FKs |
| 0023–0026 | Orders, shipments, cancellations, returns |
| 0027–0041 | Permission backfills (phases 4–7) |
| 0034–0035, 0044 | Webhook subscriptions and deliveries |
| 0042–0047 | External ID mappings, marketplace connections, webhook ingress |

### 9.3 ER diagram (logical — from migration names)

\`\`\`mermaid
erDiagram
  TENANTS ||--o{ MEMBERSHIPS : has
  USERS ||--o{ MEMBERSHIPS : has
  TENANTS ||--o{ PRODUCTS : owns
  TENANTS ||--o{ CHANNELS : owns
  CHANNELS ||--o{ OFFERS : lists
  PRODUCTS ||--o{ INVENTORY : stocks
  CHANNELS ||--o{ ORDERS : receives
  ORDERS ||--o{ SHIPMENTS : fulfills
  ORDERS ||--o{ CANCELLATIONS : may_have
  ORDERS ||--o{ RETURNS : may_have
  TENANTS ||--o{ WEBHOOK_SUBSCRIPTIONS : configures
\`\`\`

**Caution:** This diagram reflects **expected** relationships inferred from migration filenames and module boundaries, not an automated schema parse. Confirm columns/FKs in the SQL files before schema changes.

---

## 10. Testing and developer workflow

### 10.1 Commands (\`package.json\`)

| Command | Purpose | Prerequisites |
| ------- | ------- | ------------- |
| \`npm install\` | Install runtime + dev deps | Node 24+ |
| \`npm run dev\` | API with watch + SWC | \`.env\`, Docker services |
| \`npm run start\` | API production-like | Same |
| \`npm run dev:worker\` / \`start:worker\` | Background worker | Redis, Postgres |
| \`npm run build\` | Syntax check all \`src/**/*.js\` | None |
| \`npm run test:unit\` | Vitest unit project | None |
| \`npm run test:integration\` | Vitest integration | Postgres, Redis, MinIO |
| \`npm run test:jest\` | Nest Jest suite | None |
| \`npm run verify\` | lint + arch + unit tests | None |
| \`npm run migrate\` | Apply DB migrations | \`DATABASE_URL\` |
| \`docker compose up -d\` | Local infra | Docker |

**Note:** Integration tests were **not** re-executed as part of generating this document unless separately noted in your CI logs.

### 10.2 Tracing a feature

1. Find route in [Wasl_Backend_Nest_Endpoint_Inventory.md](./Wasl_Backend_Nest_Endpoint_Inventory.md).
2. Open matching \`*.controller.js\` → \`*.service.js\`.
3. Follow call into \`src/modules/<domain>/application/*\`.
4. Inspect \`infrastructure/postgres-*-repository.js\` for SQL tables touched.
5. Search \`tests/integration/*\` for the route or use case name.

---

## 11. Deployment and infrastructure

### 11.1 Docker

- \`Dockerfile\` — API container image (inspect file for Node version and start command).
- \`docker-compose.yml\` — Postgres **5433**, Redis **6380**, MinIO **9000/9001** on host; observability profile optional.

### 11.2 CI/CD

No \`.github/workflows\` were found in this repository snapshot — pipeline may live elsewhere or be not yet committed.

### 11.3 Production configuration

Use \`NODE_ENV=production\`, strong \`AUTH_JWT_*\` or asymmetric keys, real \`DATABASE_URL\`, dedicated Redis with \`noeviction\`, and locked-down \`SERVER_CORS_ORIGINS\`.

---

## 12. Dependency and architecture map

\`\`\`mermaid
flowchart LR
  subgraph HTTP
    NC[Nest Controllers]
    NG[AuthGuard]
  end
  subgraph Domain
    DM[src/modules application]
  end
  subgraph Infra
    PG[(PostgreSQL)]
    RD[(Redis)]
    BM[BullMQ]
    S3[S3/MinIO]
  end
  subgraph Async
    WK[workers/main.js]
  end
  NC --> NG
  NC --> DM
  DM --> PG
  DM --> RD
  DM --> BM
  BM --> RD
  WK --> BM
  WK --> DM
  WK --> PG
  DM --> S3
\`\`\`

---

## 13. Architecture risks and documentation gaps

| Finding | Evidence | Impact |
| ------- | -------- | ------ |
| **Dual HTTP route representations** | Nest controllers vs legacy \`*.routes.js\`; stale \`audit-route-inventory.mjs\` | Wrong route docs if using old inventory |
| **ESLint skips \`src/nest/**\`** | \`eslint.config.js\` | Nest decorator files not linted by default |
| **Build syntax check skips Nest** | \`scripts/check-syntax.mjs\` | Nest files rely on SWC/runtime compile |
| **Large surface area, uneven test depth** | 220+ integration test files but not all modules may have equal coverage | Regressions possible in untested paths |
| **RLS and tenant context** | Postgres RLS migrations | Bugs in context setup cause data leaks or denials — requires careful review |
| **BullMQ Redis policy** | \`docker-compose.yml\` documents \`noeviction\` | Wrong Redis config drops jobs silently |
| **Unverified runtime execution** | This guide generation | Execute \`test:integration\` before release |

Separate **confirmed defects** from **risks**: items above are risks/documentation gaps unless linked to a failing test or ticket.

---

## 14. Glossary

| Term | Meaning |
| ---- | ------- |
| **Tenant** | Organization slice; data isolated via tenant_id + RLS |
| **Channel** | Sales channel linked to marketplace connection |
| **Offer** | Product listing on a channel with pricing |
| **Outbox** | Transactional event table for reliable async dispatch |
| **Inbox / idempotency** | Dedup for webhooks and retries |
| **Core domain** | Object graph injected as \`CORE_DOMAIN\` into Nest |
| **Merchant compat** | ChannelEngine-style query-parameter API compatibility |
| **StockConnect** | Integration API under \`/api/v2/stock-connect\` |

---

## 15. Coverage appendix

### 15.1 File inventory

- **CSV rows (excl. header):** ${inventoryRows.length}
- **Paths under \`src/\`:** ${srcCount}
- **Layer breakdown:** aggregate via CSV pivot on \`layer\` column.

### 15.2 Endpoints documented

- **Nest static scan:** ${endpointCount}

### 15.3 Dependencies reviewed

- **Count:** ${Object.keys(pkg.dependencies ?? {}).length + Object.keys(pkg.devDependencies ?? {}).length}

### 15.4 Diagrams in this document

1. Bootstrap sequence (§4.1)  
2. HTTP auth flow (§5.1)  
3. BullMQ sequence (§5.3)  
4. Startup outbox/listen (§5.7)  
5. Logical ER (§9.3)  
6. Architecture map (§12)

### 15.5 Regeneration

\`\`\`bash
node docs/architecture/build-architecture-guide-companions.mjs
node docs/architecture/generate-architecture-guide-md.mjs
node docs/architecture/generate-architecture-guide-pdf.mjs
\`\`\`

---

*End of Wasl Backend Complete Architecture and Technology Guide.*
`;

writeFileSync(OUT, md, 'utf8');
console.log(`Wrote ${OUT} (${md.length} chars)`);

