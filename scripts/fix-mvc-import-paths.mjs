import { existsSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const LAYER = {
  domain: 'models',
  application: 'services',
  infrastructure: 'repositories',
  presentation: 'views',
};

function walk(dir, acc = []) {
  if (!existsSync(dir)) return acc;
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) {
      if (name === 'node_modules' || name === 'dist') continue;
      walk(full, acc);
    }
    else if (/\.(js|mjs|md)$/.test(name)) acc.push(full);
  }
  return acc;
}

let fixed = 0;
for (const file of [...walk('src'), ...walk('tests'), ...walk('test'), ...walk('docs')]) {
  let content = readFileSync(file, 'utf8');
  const original = content;
  for (const [from, to] of Object.entries(LAYER)) {
    content = content.replace(
      new RegExp(`(modules/[a-z0-9-]+/)${from}(/)`, 'g'),
      `$1${to}$2`,
    );
  }
  if (content !== original) {
    writeFileSync(file, content);
    fixed += 1;
    console.log(file);
  }
}
console.log(`fixed ${fixed} files`);
