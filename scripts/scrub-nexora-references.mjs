#!/usr/bin/env node
/**
 * One-off scrubber: replace legacy Nexora naming with Wasl in text files.
 * Skips node_modules, applied migration SQL (checksum-locked), and PDF/binaries.
 */
import { createHash } from 'node:crypto';
import { readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { extname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(fileURLToPath(import.meta.url), '..', '..');
const SKIP_DIRS = new Set(['node_modules', '.git', 'dist', 'coverage', '.pdf-pages']);
const TEXT_EXT = new Set([
  '.js', '.mjs', '.cjs', '.ts', '.json', '.md', '.yml', '.yaml', '.sql', '.txt', '.csv', '.html', '.example',
]);

/** Applied migrations must not change on disk (checksum guard). */
const SKIP_FILES = new Set([
  'src/infrastructure/postgres/migrations/0042_external_integer_id_mappings.sql',
  'src/infrastructure/postgres/migrations/0043_channels_default_stock_location.sql',
  'src/infrastructure/postgres/migrations/0045_marketplace_connections.sql',
  'src/infrastructure/postgres/migrations/0047_marketplace_webhook_ingress.sql',
  'src/infrastructure/postgres/migrations/0049_wasl_persisted_identifier_rename.sql',
  'scripts/scrub-nexora-references.mjs',
]);

/** @param {string} dir @param {string[]} out */
function walk(dir, out = []) {
  for (const entry of readdirSync(dir)) {
    if (SKIP_DIRS.has(entry)) continue;
    const full = join(dir, entry);
    const st = statSync(full);
    if (st.isDirectory()) {
      walk(full, out);
    } else if (TEXT_EXT.has(extname(entry).toLowerCase())) {
      out.push(full);
    }
  }
  return out;
}

/** @param {string} text */
function scrub(text) {
  let n = text;
  const pairs = [
    ['NexoraConfigModule', 'WaslConfigModule'],
    ['Nexora-issued', 'Wasl-issued'],
    ['Nexora-managed', 'Wasl-managed'],
    ['Nexora-assigned', 'Wasl-assigned'],
    ['Nexora-side', 'Wasl-side'],
    ["Nexora's", "Wasl's"],
    ['in Nexora', 'in Wasl'],
    ['to Nexora', 'to Wasl'],
    ['Nexora ', 'Wasl '],
    ['Nexora,', 'Wasl,'],
    ['Nexora.', 'Wasl.'],
    ['Nexora/', 'Wasl/'],
    ['nexora_retention_cleanup', 'wasl_retention_cleanup'],
    ['nexora-external-integration-readiness', 'wasl-external-integration-readiness'],
    ['nexora-dev', 'wasl-dev'],
    ['admin@nexora.dev', 'admin@wasl.dev'],
    ['<nexora-host>', '<wasl-host>'],
    ['<nexora-production-host>', '<wasl-production-host>'],
    ['nexora-backend', 'wasl-backend'],
    ['nexora-docs-tooling', 'wasl-docs-tooling'],
    ['NEXORA_INTEGRATION_REDIS_URL', 'WASL_INTEGRATION_REDIS_URL'],
    ['nexora-secret', 'wasl-secret'],
    ['nexora-local', 'wasl-local'],
    ['nexora-queue', 'wasl-queue'],
    ['postgresql://wasl:nexora@', 'postgresql://wasl:wasl@'],
    ['-d nexora', '-d wasl'],
    ['DATABASE nexora', 'DATABASE wasl'],
    ['database "nexora"', 'database "wasl"'],
    ['database nexora', 'database wasl'],
    ['CREATE DATABASE nexora', 'CREATE DATABASE wasl'],
    ['GRANT ALL PRIVILEGES ON DATABASE nexora', 'GRANT ALL PRIVILEGES ON DATABASE wasl'],
    ['GRANT CONNECT ON DATABASE nexora', 'GRANT CONNECT ON DATABASE wasl'],
    ["rolname = 'nexora_app'", "rolname = 'wasl_app'"],
    ["rolname = 'nexora')", "rolname = 'wasl')"],
    ['CREATE ROLE nexora_app', 'CREATE ROLE wasl_app'],
    ['CREATE ROLE nexora ', 'CREATE ROLE wasl '],
    ['ALTER ROLE nexora_app', 'ALTER ROLE wasl_app'],
    ['ALTER ROLE nexora ', 'ALTER ROLE wasl '],
    ['TO nexora_app', 'TO wasl_app'],
    ['TO nexora;', 'TO wasl;'],
    ['PASSWORD \'nexora\'', "PASSWORD 'wasl'"],
    ['nexora-5434.dump', 'wasl-5434.dump'],
    ['nexora-roles-5434.sql', 'wasl-roles-5434.sql'],
    ['| `nexora` (Docker default owner)', '| `wasl` (Docker default owner)'],
    ['deployed Nexora', 'deployed Wasl'],
    ['monitor `stockconnect_ce_compat` on deployed Nexora', 'monitor `stockconnect_ce_compat` on deployed Wasl'],
    ['stored encrypted in Nexora', 'stored encrypted in Wasl'],
    ['Guide for Nexora', 'Guide for Wasl'],
    ['working with Nexora', 'working with Wasl'],
    ["Nexora's provider-neutral", "Wasl's provider-neutral"],
    ['support in Nexora', 'support in Wasl'],
    ['reuse Nexora', 'reuse Wasl'],
    ['poll → Nexora)', 'poll → Wasl)'],
    ['(Nexora-side', '(Wasl-side'],
    ['Done** (Nexora-side', 'Done** (Wasl-side'],
  ];
  for (const [from, to] of pairs) {
    n = n.split(from).join(to);
  }
  return n;
}

const files = walk(ROOT);
let changed = 0;
for (const file of files) {
  const rel = relative(ROOT, file).replace(/\\/g, '/');
  if (SKIP_FILES.has(rel)) continue;
  if (rel.endsWith('.pdf')) continue;
  const before = readFileSync(file, 'utf8');
  const after = scrub(before);
  if (after !== before) {
    writeFileSync(file, after);
    changed += 1;
  }
}

console.log(JSON.stringify({ scanned: files.length, changed }, null, 2));
