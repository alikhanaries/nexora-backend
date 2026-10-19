import { readdirSync, readFileSync, writeFileSync, statSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));

function walk(dir, out = []) {
  if (!existsSync(dir)) return out;
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) walk(full, out);
    else if (full.endsWith('.js')) out.push(full);
  }
  return out;
}

for (const dir of [
  'tests/unit/orders/marketplace-ingestion',
  'tests/unit/webhooks/marketplace',
]) {
  for (const file of walk(join(root, dir))) {
    const before = readFileSync(file, 'utf8');
    const after = before.replaceAll("from '../../../src/", "from '../../../../src/");
    if (after !== before) {
      writeFileSync(file, after);
      console.log('fixed', file.slice(root.length + 1));
    }
  }
}

// Same-module order model refs inside orders/marketplace-ingestion
for (const file of walk(join(root, 'src/modules/orders/marketplace-ingestion'))) {
  const before = readFileSync(file, 'utf8');
  const after = before
    .replaceAll("import('../../../orders/models/", "import('../../models/")
    .replaceAll("from '../../../orders/models/", "from '../../models/");
  if (after !== before) {
    writeFileSync(file, after);
    console.log('orders-model', file.slice(root.length + 1));
  }
}

console.log('done');
