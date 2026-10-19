import { readdirSync, readFileSync, writeFileSync, statSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));

function walk(dir, out = []) {
  if (!existsSync(dir)) return out;
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) walk(full, out);
    else if (full.endsWith('.js') || full.endsWith('.md')) out.push(full);
  }
  return out;
}

function rewrite(file, transform) {
  const before = readFileSync(file, 'utf8');
  const after = transform(before);
  if (after !== before) {
    writeFileSync(file, after);
    console.log('fixed', file.slice(root.length + 1));
  }
}

// Only nested folders under marketplace/ (services, public, models, views) need ../../../
for (const sub of ['services', 'public', 'models', 'views']) {
  for (const file of walk(join(root, 'src/modules/webhooks/marketplace', sub))) {
    rewrite(file, (c) =>
      c
        .replaceAll(
          "from '../../orders/marketplace-ingestion/",
          "from '../../../orders/marketplace-ingestion/",
        )
        .replaceAll(
          "import('../../orders/marketplace-ingestion/",
          "import('../../../orders/marketplace-ingestion/",
        ),
    );
  }
  for (const file of walk(join(root, 'src/modules/orders/marketplace-ingestion', sub))) {
    rewrite(file, (c) =>
      c
        .replaceAll(
          "from '../../webhooks/marketplace/",
          "from '../../../webhooks/marketplace/",
        )
        .replaceAll(
          "import('../../webhooks/marketplace/",
          "import('../../../webhooks/marketplace/",
        ),
    );
  }
}

console.log('done');
