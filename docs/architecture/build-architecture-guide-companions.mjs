#!/usr/bin/env node
/**
 * Documentation-only: generates companion inventories for the architecture guide.
 * Does not modify application source under src/ (except writing docs under docs/).
 */
import { readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '../..');
const OUT_DIR = join(dirname(fileURLToPath(import.meta.url)));

function walk(dir, acc = [], opts = {}) {
  if (!statSync(dir, { throwIfNoEntry: false })?.isDirectory()) {
    return acc;
  }
  for (const ent of readdirSync(dir, { withFileTypes: true })) {
    if (ent.name === 'node_modules' || ent.name === 'dist' || ent.name === '.git') {
      continue;
    }
    const p = join(dir, ent.name);
    if (ent.isDirectory()) {
      walk(p, acc, opts);
    } else if (/\.(js|mjs|cjs)$/.test(ent.name)) {
      acc.push(relative(ROOT, p).replace(/\\/g, '/'));
    }
  }
  return acc;
}

function layerForPath(path) {
  if (path.startsWith('src/app/')) return 'nest-http';
  if (path.startsWith('src/modules/')) return 'domain-module';
  if (path.startsWith('src/app/')) return 'application-bootstrap';
  if (path.startsWith('src/infrastructure/')) return 'infrastructure';
  if (path.startsWith('src/workers/')) return 'workers';
  if (path.startsWith('src/shared/')) return 'shared';
  if (path.startsWith('src/integrations/')) return 'integrations';
  if (path.startsWith('tests/')) return 'vitest';
  if (path.startsWith('test/')) return 'jest-nest';
  if (path.startsWith('scripts/')) return 'scripts';
  return 'other';
}

function scanNestControllers() {
  const nestDir = join(ROOT, 'src/app');
  const re = /@(Get|Post|Put|Patch|Delete)\(\s*['`]([^'`]+)['`]/g;
  const routes = [];
  for (const file of walk(nestDir)) {
    if (!file.endsWith('.controller.js')) {
      continue;
    }
    const src = readFileSync(join(ROOT, file), 'utf8');
    re.lastIndex = 0;
    let m = re.exec(src);
    while (m !== null) {
      routes.push({ method: m[1].toUpperCase(), path: m[2], controller: file });
      m = re.exec(src);
    }
  }
  routes.sort((a, b) => a.path.localeCompare(b.path) || a.method.localeCompare(b.method));
  return routes;
}

function parseEnvSchema() {
  const schemaPath = join(ROOT, 'src/app/config/schema.js');
  const src = readFileSync(schemaPath, 'utf8');
  const keys = [...src.matchAll(/^\s{4}([A-Z][A-Z0-9_]+):/gm)].map((x) => x[1]);
  return [...new Set(keys)];
}

const srcFiles = walk(join(ROOT, 'src'));
const testFiles = walk(join(ROOT, 'tests'));
const jestFiles = walk(join(ROOT, 'test'));
const scriptFiles = walk(join(ROOT, 'scripts'));
const nestRoutes = scanNestControllers();
const envKeys = parseEnvSchema();

const inventoryLines = [
  'path,layer',
  ...srcFiles.map((p) => `${p},${layerForPath(p)}`),
  ...testFiles.map((p) => `${p},${layerForPath(p)}`),
  ...jestFiles.map((p) => `${p},${layerForPath(p)}`),
  ...scriptFiles.map((p) => `${p},${layerForPath(p)}`),
];
writeFileSync(join(OUT_DIR, 'Wasl_Backend_Source_File_Inventory.csv'), inventoryLines.join('\n'), 'utf8');

const routeMd = [
  '# Nest HTTP endpoint inventory (static scan)',
  '',
  `Generated from \`src/app/**/*.controller.js\` decorator paths.`,
  '',
  `**Total routes:** ${nestRoutes.length}`,
  '',
  '| Method | Path | Controller |',
  '| ------ | ---- | ---------- |',
  ...nestRoutes.map((r) => `| ${r.method} | \`${r.path}\` | \`${r.controller}\` |`),
  '',
].join('\n');
writeFileSync(join(OUT_DIR, 'Wasl_Backend_Nest_Endpoint_Inventory.md'), routeMd, 'utf8');

const envMd = [
  '# Environment variables (from config schema)',
  '',
  'Source: `src/app/config/schema.js` — values are not secrets; do not commit real `.env`.',
  '',
  `**Count:** ${envKeys.length}`,
  '',
  '| Variable |',
  '| -------- |',
  ...envKeys.map((k) => `| \`${k}\` |`),
  '',
].join('\n');
writeFileSync(join(OUT_DIR, 'Wasl_Backend_Environment_Variables.md'), envMd, 'utf8');

console.log(
  JSON.stringify(
    {
      srcFiles: srcFiles.length,
      testVitestFiles: testFiles.length,
      testJestFiles: jestFiles.length,
      scriptFiles: scriptFiles.length,
      nestRoutes: nestRoutes.length,
      envVariables: envKeys.length,
    },
    null,
    2,
  ),
);

