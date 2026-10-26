#!/usr/bin/env node
/**
 * Reports remaining "nexora" matches (case-insensitive) excluding node_modules.
 */
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { extname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(fileURLToPath(import.meta.url), '..', '..');
const SKIP_DIRS = new Set(['node_modules', '.git', 'dist', 'coverage']);
const RE = /nexora/i;

/** @param {string} dir @param {string[]} out */
function walk(dir, out = []) {
  for (const entry of readdirSync(dir)) {
    if (SKIP_DIRS.has(entry)) continue;
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) walk(full, out);
    else out.push(full);
  }
  return out;
}

const hits = [];
for (const file of walk(ROOT)) {
  if (extname(file).toLowerCase() === '.pdf') continue;
  let text;
  try {
    text = readFileSync(file, 'utf8');
  } catch {
    continue;
  }
  if (!RE.test(text)) continue;
  const rel = relative(ROOT, file).replace(/\\/g, '/');
  const lines = text.split('\n');
  const samples = [];
  for (let i = 0; i < lines.length && samples.length < 3; i += 1) {
    if (RE.test(lines[i])) samples.push({ line: i + 1, excerpt: lines[i].trim().slice(0, 100) });
  }
  hits.push({ file: rel, samples });
}

console.log(JSON.stringify({ totalFiles: hits.length, hits }, null, 2));
