/**
 * Phase 3C documentation branding — safe, targeted replacements only.
 * Does not modify src/application logic, migrations, or .env.
 */
import { readFileSync, readdirSync, statSync, writeFileSync, existsSync } from 'node:fs';
import { extname, join } from 'node:path';

const ROOT = join(import.meta.dirname, '..');
const SKIP_DIR = new Set(['node_modules', '.git', 'dist']);
const EXT = new Set(['.md', '.json', '.mjs']);

function shouldSkipLine(line) {
  if (/nexora_entity|integrationEntityType|integrationEntityId|wasl_entity_type|wasl_entity_id/.test(line)) {
    return true;
  }
  if (/postgresql:\/\/nexora|nexora:nexora@|wasl-local|'nexora'/.test(line) && /DATABASE|STORAGE|docker/i.test(line)) {
    return true;
  }
  if (/stockconnect-ce-bridge|ce-compat:/.test(line)) {
    return true;
  }
  return false;
}

const PAIRS = [
  ['Wasl Backend Documentation', 'Wasl Backend Documentation'],
  ['Wasl Backend API', 'Wasl Backend API'],
  ['Wasl Backend', 'Wasl Backend'],
  ['Wasl backend', 'Wasl backend'],
  ['Wasl commerce', 'Wasl commerce'],
  ['Wasl API', 'Wasl API'],
  ['Wasl platform', 'Wasl platform'],
  ['Wasl Local', 'Wasl Local'],
  ['the Nexora', 'the Wasl'],
  ['Wasl ', 'Wasl '],
  ['wasl-backend', 'wasl-backend'],
  [
    'src/modules/channels/presentation/channel.routes.js',
    'src/modules/commerce-integrations/presentation/commerce-integration.routes.js',
  ],
  ['src/modules/channels/', 'src/modules/commerce-integrations/'],
  ['modules/channel-catalog-sync/', 'modules/integration-catalog-sync/'],
  ['merchant-protocol.routes.js', 'compat-v2.routes.js'],
  ['merchant-protocol compatibility', 'compat v2 compatibility'],
  ['merchant-protocol', 'compat v2'],
  ['Nexora_Backend_API.postman_collection.json', 'Wasl_Backend_API.postman_collection.json'],
  ['Nexora_Local.postman_environment.json', 'Wasl_Local.postman_environment.json'],
  ['Nexora_Backend_', 'Wasl_Backend_'],
];

/** @param {string} dir @param {string[]} out */
function walk(dir, out = []) {
  for (const ent of readdirSync(dir)) {
    if (SKIP_DIR.has(ent)) {
      continue;
    }
    const p = join(dir, ent);
    if (statSync(p).isDirectory()) {
      walk(p, out);
    } else if (EXT.has(extname(ent)) && ent !== 'phase3b-wasl-rename.mjs' && ent !== 'phase3c-wasl-docs.mjs') {
      out.push(p);
    }
  }
  return out;
}

const targets = [];
for (const rel of ['docs', 'postman', 'infrastructure']) {
  const p = join(ROOT, rel);
  if (existsSync(p)) {
    walk(p, targets);
  }
}
for (const rel of ['nest/README.md', 'src/modules/README.md']) {
  const p = join(ROOT, rel);
  if (existsSync(p)) {
    targets.push(p);
  }
}

let updated = 0;
for (const file of targets) {
  if (file.includes('marketplace-nexora-entity-type')) {
    continue;
  }
  const original = readFileSync(file, 'utf8');
  const lines = original.split('\n');
  let changed = false;
  const next = lines.map((line) => {
    if (shouldSkipLine(line)) {
      return line;
    }
    let n = line;
    for (const [from, to] of PAIRS) {
      n = n.split(from).join(to);
    }
    if (n !== line) {
      changed = true;
    }
    return n;
  });
  if (changed) {
    writeFileSync(file, `${next.join('\n')}\n`);
    updated += 1;
  }
}

console.log(`Phase 3C docs pass: ${updated} files updated (${targets.length} scanned).`);
