/**
 * After nesting under orders/ and webhooks/, sibling module imports from
 * services/public/models/views need one extra ../ to reach src/modules/.
 */
import { readdirSync, readFileSync, writeFileSync, statSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));

const SIBLINGS = [
  'api-keys',
  'audit',
  'authorization',
  'cancellations',
  'commerce-integrations',
  'compatibility',
  'external-id-mapping',
  'health',
  'identity',
  'integration-catalog-sync',
  'inventory',
  'marketplaces',
  'mfa',
  'offers',
  'orders',
  'pricing',
  'products',
  'returns',
  'shipments',
  'stock-connect',
  'tenants',
  'webhooks',
];

function walk(dir, out = []) {
  if (!existsSync(dir)) return out;
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) walk(full, out);
    else if (full.endsWith('.js')) out.push(full);
  }
  return out;
}

function bumpSiblings(content) {
  let next = content;
  for (const sibling of SIBLINGS) {
    // from '../../sibling/  -> from '../../../sibling/
    // but not from '../../../sibling/ (already bumped)
    // and not orders-internal paths when sibling === 'orders' from inside orders/marketplace-ingestion
    const reFrom = new RegExp(`from ['"]\\.\\./\\.\\./${sibling}/`, 'g');
    const reImport = new RegExp(`import\\(['"]\\.\\./\\.\\./${sibling}/`, 'g');
    next = next.replace(reFrom, `from '../../../${sibling}/`);
    next = next.replace(reImport, `import('../../../${sibling}/`);
  }
  return next;
}

function rewriteTree(base, { skipOrdersSibling = false } = {}) {
  for (const sub of ['services', 'public', 'models', 'views']) {
    for (const file of walk(join(base, sub))) {
      const before = readFileSync(file, 'utf8');
      let after = bumpSiblings(before);
      if (skipOrdersSibling) {
        // Revert accidental bump of orders/* that should stay as ../../ (same parent module)
        after = after
          .replaceAll("from '../../../orders/services/", "from '../../services/")
          .replaceAll("from '../../../orders/repositories/", "from '../../repositories/")
          .replaceAll("from '../../../orders/public/", "from '../../public/")
          .replaceAll("from '../../../orders/controllers/", "from '../../controllers/")
          .replaceAll("from '../../../orders/views/", "from '../../views/")
          .replaceAll("from '../../../orders/models/", "from '../../models/")
          .replaceAll("import('../../../orders/services/", "import('../../services/")
          .replaceAll("import('../../../orders/repositories/", "import('../../repositories/")
          .replaceAll("import('../../../orders/public/", "import('../../public/");
        // marketplace-ingestion under orders should keep ../../../orders/marketplace-ingestion only from outside;
        // from inside, don't use orders/marketplace-ingestion via sibling bump
        after = after.replaceAll(
          "from '../../../orders/marketplace-ingestion/",
          "from '../",
        );
        // That last replace is too aggressive for services referencing public via ../ 
        // Actually inside marketplace-ingestion, paths to self use ./ or ../public — not ../../orders/
        // Sibling bump of 'orders' would turn ../../orders/marketplace-ingestion into ../../../orders/marketplace-ingestion
        // which from services is correct for... no, self shouldn't import via orders/marketplace-ingestion.
      }
      if (after !== before) {
        writeFileSync(file, after);
        console.log('fixed', file.slice(root.length + 1));
      }
    }
  }
}

// orders/marketplace-ingestion: bump siblings, but keep same-module orders paths at ../../
rewriteTree(join(root, 'src/modules/orders/marketplace-ingestion'), { skipOrdersSibling: true });

// webhooks/marketplace: bump siblings (including orders)
rewriteTree(join(root, 'src/modules/webhooks/marketplace'));

console.log('done');
