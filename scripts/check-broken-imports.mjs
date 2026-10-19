import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join } from 'node:path';

const ROOT = join(import.meta.dirname, '..', 'src');
const importRe = /from ['"](\.\.?\/[^'"]+)['"]/g;

/** @param {string} dir @param {string[]} out */
function walk(dir, out = []) {
  for (const entry of readdirSync(dir)) {
    const p = join(dir, entry);
    if (statSync(p).isDirectory()) {
      if (entry === 'node_modules') continue;
      walk(p, out);
    } else if (p.endsWith('.js')) {
      out.push(p);
    }
  }
  return out;
}

const broken = [];
for (const file of walk(ROOT)) {
  const text = readFileSync(file, 'utf8');
  importRe.lastIndex = 0;
  let match = importRe.exec(text);
  while (match !== null) {
    const spec = match[1];
    const base = join(dirname(file), spec);
    const ok = [base, `${base}.js`, join(base, 'index.js')].some((c) => existsSync(c));
    if (!ok) {
      broken.push({ file: file.replace(/\\/g, '/'), spec });
    }
    match = importRe.exec(text);
  }
}

console.log(JSON.stringify({ brokenCount: broken.length, broken: broken.slice(0, 30) }, null, 2));
process.exitCode = broken.length > 0 ? 1 : 0;
