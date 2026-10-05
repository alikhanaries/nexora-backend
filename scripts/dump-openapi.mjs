#!/usr/bin/env node
/**
 * Dumps OpenAPI JSON from a bootstrapped app (requires DATABASE_URL/REDIS like tests).
 */
import { config as loadEnv } from 'dotenv';
loadEnv({ path: '.env', override: false });
process.env.NODE_ENV ??= 'test';
process.env.DOCS_ENABLED ??= 'true';

import { writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createApplication } from '../src/app/bootstrap/create-application.js';
import { closeTestInfrastructure, getTestInfrastructure } from '../tests/integration/helpers.js';

const outPath = process.argv[2] ?? join(dirname(fileURLToPath(import.meta.url)), '..', 'docs', '.openapi-snapshot.json');

const infra = await getTestInfrastructure();
const app = await createApplication(infra);
const res = await app.httpServer.inject({ method: 'GET', url: '/openapi.json' });
if (res.statusCode !== 200) {
    console.error('Failed to fetch openapi.json', res.statusCode, res.body);
    process.exit(1);
}
const payload = typeof res.body === 'string' ? res.body : JSON.stringify(res.json());
writeFileSync(outPath, payload, 'utf8');
console.log(`Wrote ${outPath} (${Object.keys(res.json().paths ?? {}).length} paths)`);
await app.httpServer.close();
await closeTestInfrastructure();
