#!/usr/bin/env node
/**
 * Static parity scan: Fastify `*.routes.js` + create-server vs Nest `@Get/@Post/...` controllers.
 * Documentation / validation only — does not start servers.
 */
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const SRC = join(ROOT, 'src');

const ROUTE_FILE_SUFFIX = '.routes.js';
const ROUTE_TYPED_RE = /typed\.(get|post|put|patch|delete|head|options)\(\s*['"]([^'"]+)['"]/g;
const ROUTE_APP_RE = /app\.(get|post|put|patch|delete|head|options)\(\s*['"]([^'"]+)['"]/g;
const NEST_HTTP_RE = /@(Get|Post|Put|Patch|Delete|Head|Options)\(\s*['"]([^'"]+)['"]/g;

function walk(dir, acc = [], filter) {
  for (const ent of readdirSync(dir)) {
    const p = join(dir, ent);
    if (statSync(p).isDirectory()) {
      if (ent === 'node_modules' || ent === 'dist') {
        continue;
      }
      walk(p, acc, filter);
    } else if (filter(p)) {
      acc.push(p);
    }
  }
  return acc;
}

function scanRe(filePath, re) {
  const src = readFileSync(filePath, 'utf8');
  const rel = relative(ROOT, filePath).replace(/\\/g, '/');
  const found = [];
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
  return found;
}

function scanFastify() {
  const files = walk(SRC, [], (p) => p.endsWith(ROUTE_FILE_SUFFIX) || p.endsWith('create-server.js'));
  const all = files.flatMap((f) => [...scanRe(f, ROUTE_TYPED_RE), ...scanRe(f, ROUTE_APP_RE)]);
  const map = new Map();
  for (const r of all) {
    map.set(`${r.method} ${r.path}`, r);
  }
  return map;
}

function scanNest() {
  const nestRoot = join(SRC, 'nest');
  const files = walk(nestRoot, [], (p) => p.endsWith('.controller.js'));
  const all = files.flatMap((f) => scanRe(f, NEST_HTTP_RE));
  const map = new Map();
  for (const r of all) {
    map.set(`${r.method} ${r.path}`, r);
  }
  return map;
}

const fastify = scanFastify();
const nest = scanNest();

const allKeys = [...new Set([...fastify.keys(), ...nest.keys()])].sort(
  (a, b) => a.localeCompare(b),
);

const rows = allKeys.map((key) => {
  const f = fastify.has(key);
  const n = nest.has(key);
  let match = 'PASS';
  if (f && !n) {
    match = 'FASTIFY_ONLY';
  } else if (!f && n) {
    match = 'NEST_ONLY';
  } else if (!f && !n) {
    match = 'NONE';
  }
  return { key, fastify: f, nest: n, match };
});

const fastifyOnly = rows.filter((r) => r.match === 'FASTIFY_ONLY');
const nestOnly = rows.filter((r) => r.match === 'NEST_ONLY');
const pass = rows.filter((r) => r.match === 'PASS');

console.log(JSON.stringify({
  fastifyCount: fastify.size,
  nestCount: nest.size,
  matched: pass.length,
  fastifyOnly: fastifyOnly.length,
  nestOnly: nestOnly.length,
  fastifyOnlyRoutes: fastifyOnly.map((r) => r.key),
  nestOnlyRoutes: nestOnly.map((r) => r.key),
}, null, 2));
