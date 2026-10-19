/**
 * Nested feature slices are one level deeper under modules/, so src-root
 * imports (shared/infrastructure/app/...) need one extra ../ from layer folders.
 */
import { readdirSync, readFileSync, writeFileSync, statSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
const SRC_ROOTS = ['shared', 'infrastructure', 'app', 'integrations', 'workers', 'nest'];

function walk(dir, out = []) {
  if (!existsSync(dir)) return out;
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) walk(full, out);
    else if (full.endsWith('.js')) out.push(full);
  }
  return out;
}

/** Bump exactly 3-level ../ to 4-level for src roots (not already 4+). */
function bump3to4(content) {
  let next = content;
  for (const name of SRC_ROOTS) {
    next = next.replace(
      new RegExp(`from '\\.\\./\\.\\./\\.\\./(?!\\.\\./)${name}/`, 'g'),
      `from '../../../../${name}/`,
    );
    next = next.replace(
      new RegExp(`from "\\.\\./\\.\\./\\.\\./(?!\\.\\./)${name}/`, 'g'),
      `from "../../../../${name}/`,
    );
    next = next.replace(
      new RegExp(`import\\('\\.\\./\\.\\./\\.\\./(?!\\.\\./)${name}/`, 'g'),
      `import('../../../../${name}/`,
    );
  }
  return next;
}

const layerDirs = ['services', 'public', 'models', 'views', 'repositories'];

for (const base of [
  'src/modules/orders/marketplace-ingestion',
  'src/modules/webhooks/marketplace',
  'src/modules/webhooks/outbound',
]) {
  for (const sub of layerDirs) {
    for (const file of walk(join(root, base, sub))) {
      const before = readFileSync(file, 'utf8');
      const after = bump3to4(before);
      if (after !== before) {
        writeFileSync(file, after);
        console.log('fixed', file.slice(root.length + 1));
      }
    }
  }
}

console.log('done');
