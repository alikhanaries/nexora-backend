#!/usr/bin/env node
/**
 * Repository naming guard — fails on unapproved legacy internal identifiers.
 * Allowlisted strings come from WASL_EXTERNAL_COMPATIBILITY in naming.config.js.
 */
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { extname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  WASL_EXTERNAL_COMPATIBILITY,
  WASL_NAMING,
  validateWaslNaming,
} from '../src/shared/config/wasl-naming.config.js';

const ROOT = join(fileURLToPath(import.meta.url), '..', '..');
const SKIP_DIRS = new Set(['node_modules', '.git', 'dist', 'coverage']);
const SCAN_EXTENSIONS = new Set(['.js', '.mjs', '.cjs', '.ts', '.json', '.md', '.yml', '.yaml']);

/** Paths always excluded from scans (generated or one-off migration tooling). */
const SKIP_FILES = new Set([
  'scripts/phase3b-wasl-rename.mjs',
  'scripts/phase3c-wasl-docs.mjs',
  'scripts/verify-wasl-naming.mjs',
]);

/** @param {string} dir @param {string[]} out */
function walk(dir, out = []) {
  for (const entry of readdirSync(dir)) {
    if (SKIP_DIRS.has(entry)) continue;
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      walk(full, out);
    } else if (SCAN_EXTENSIONS.has(extname(entry))) {
      const rel = relative(ROOT, full).replace(/\\/g, '/');
      if (!SKIP_FILES.has(rel)) {
        out.push(full);
      }
    }
  }
  return out;
}

const ALLOWLIST_VALUES = new Set(
  WASL_EXTERNAL_COMPATIBILITY.map((entry) => entry.value.toLowerCase()),
);

/** Additional literal allowlist (docker/local fixture usernames, historical ADR titles). */
const EXTRA_ALLOWLIST = [
  'postgresql://nexora',
  'nexora_app',
  'nexora@',
  'nexora-local',
  'nexora-secret',
  'channelengine compatibility',
  'channel-engine compatibility',
  'adr-007-channelengine',
  'stockconnect-ce',
  'stockconnect ce',
  '/api/v2/ce',
  'x-ce-key',
  'channel_catalog_sync_jobs_total',
  'channelengine-webhook',
  'webhooks/nexora',
  'hooks.example.com/nexora',
  'postgresql://nexora',
  'password = \'nexora\'',
  'storage_access_key_id ??= \'nexora\'',
  "storage_access_key_id: 'nexora'",
  "storage_secret_access_key: 'nexora",
  'nexora-local',
  'nexora-secret',
  'nexora_integration_redis_url',
];

const FORBIDDEN_PATTERNS = [
  { id: 'product-nexora', re: /\bnexora\b/i, label: 'legacy product name' },
  { id: 'product-nexora-backend', re: /\bnexora-backend\b/i, label: 'legacy package name' },
  { id: 'provider-channelengine', re: /\bchannelengine\b|\bchannel-engine\b/i, label: 'legacy provider branding' },
  { id: 'internal-merchant-protocol', re: /\bmerchant-protocol\b/i, label: 'obsolete internal compat name' },
  { id: 'module-path-channels', re: /modules\/channels\//i, label: 'removed channels module path' },
  { id: 'module-path-channel-catalog-sync', re: /modules\/channel-catalog-sync\//i, label: 'removed channel-catalog-sync module path' },
  { id: 'factory-create-channels-module', re: /\bcreateChannelsModule\b/, label: 'removed module factory' },
  { id: 'env-nexora-prefix', re: /\bNEXORA_[A-Z0-9_]+\b/, label: 'legacy NEXORA_* env token' },
];

/**
 * @param {string} line
 * @returns {boolean}
 */
function lineIsAllowlisted(line) {
  const lower = line.toLowerCase();
  for (const value of ALLOWLIST_VALUES) {
    if (lower.includes(value.toLowerCase())) {
      return true;
    }
  }
  for (const extra of EXTRA_ALLOWLIST) {
    if (lower.includes(extra.toLowerCase())) {
      return true;
    }
  }
  if (lower.includes('wasl_external_compatibility') || lower.includes('migrationplan')) {
    return true;
  }
  if (lower.includes('nexora_entity') || lower.includes('nexoraentity')) {
    return true;
  }
  return false;
}

/** Active code and tooling — strict guard (excludes historical ADR archives). */
const scanRoots = ['src', 'tests', 'test', 'scripts', 'postman', 'nest', 'infrastructure'];
const files = scanRoots.flatMap((rel) => {
  const abs = join(ROOT, rel);
  try {
    return walk(abs);
  } catch {
    return [];
  }
});

const violations = [];
for (const file of files) {
  const rel = relative(ROOT, file).replace(/\\/g, '/');
  if (rel === 'src/shared/config/wasl-naming.config.js' || rel === 'src/app/config/naming.config.js') {
    continue;
  }
  const lines = readFileSync(file, 'utf8').split('\n');
  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i];
    if (lineIsAllowlisted(line)) {
      continue;
    }
    if (/\bFORBIDDEN\b|\bPROVIDER_NAME_PATTERN\b/.test(line)) {
      continue;
    }
    for (const pattern of FORBIDDEN_PATTERNS) {
      if (pattern.re.test(line)) {
        violations.push({
          file: rel,
          line: i + 1,
          rule: pattern.id,
          label: pattern.label,
          excerpt: line.trim().slice(0, 120),
        });
      }
    }
  }
}

const namingProblems = validateWaslNaming(WASL_NAMING);
if (namingProblems.length > 0) {
  console.error('WASL_NAMING validation failed:', namingProblems);
  process.exitCode = 1;
}

if (violations.length > 0) {
  console.error(`Wasl naming guard: ${violations.length} violation(s)\n`);
  for (const v of violations.slice(0, 80)) {
    console.error(`${v.file}:${v.line} [${v.rule}] ${v.label}`);
    console.error(`  ${v.excerpt}\n`);
  }
  if (violations.length > 80) {
    console.error(`... and ${violations.length - 80} more`);
  }
  process.exitCode = 1;
} else {
  console.log(`Wasl naming guard: OK (${files.length} files scanned)`);
}
