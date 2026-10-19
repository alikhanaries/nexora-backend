/**
 * Consolidate feature modules into clean MVC ownership:
 *   marketplace-order-ingestion  -> orders/marketplace-ingestion
 *   marketplace-webhook-ingestion -> webhooks/marketplace
 *   existing webhooks MVC          -> webhooks/outbound
 *
 * Usage: node scripts/consolidate-orders-webhooks-mvc.mjs [--dry-run]
 */
import {
  cpSync,
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  renameSync,
  rmSync,
  statSync,
  writeFileSync,
} from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = fileURLToPath(new URL('..', import.meta.url));
const dryRun = process.argv.includes('--dry-run');

const TEXT_EXT = new Set(['.js', '.mjs', '.cjs', '.ts', '.md', '.json', '.yml', '.yaml']);

const MOVES = [
  {
    from: 'src/modules/marketplace-order-ingestion',
    to: 'src/modules/orders/marketplace-ingestion',
  },
  {
    from: 'src/modules/marketplace-webhook-ingestion',
    to: 'src/modules/webhooks/marketplace',
  },
];

/** Folders currently at webhooks root that belong to outbound merchant webhooks. */
const WEBHOOKS_OUTBOUND_DIRS = [
  'models',
  'services',
  'repositories',
  'views',
  'controllers',
  'public',
];

function ensureDir(path) {
  if (!existsSync(path) && !dryRun) mkdirSync(path, { recursive: true });
}

function movePath(from, to) {
  if (!existsSync(from)) {
    console.log(`skip missing ${relative(repoRoot, from)}`);
    return false;
  }
  console.log(`${dryRun ? '[dry] ' : ''}mv ${relative(repoRoot, from)} → ${relative(repoRoot, to)}`);
  if (dryRun) return true;
  ensureDir(dirname(to));
  if (existsSync(to)) {
    for (const name of readdirSync(from)) {
      const src = join(from, name);
      const dest = join(to, name);
      if (existsSync(dest)) {
        console.warn(`  skip exists ${relative(repoRoot, dest)}`);
        continue;
      }
      try {
        renameSync(src, dest);
      } catch {
        cpSync(src, dest, { recursive: true });
        rmSync(src, { recursive: true, force: true });
      }
    }
    if (existsSync(from) && readdirSync(from).length === 0) {
      rmSync(from, { recursive: true, force: true });
    }
    return true;
  }
  try {
    renameSync(from, to);
  } catch {
    cpSync(from, to, { recursive: true });
    rmSync(from, { recursive: true, force: true });
  }
  return true;
}

function walkFiles(dir, out = []) {
  if (!existsSync(dir)) return out;
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) {
      if (name === 'node_modules' || name === '.git' || name === 'coverage') continue;
      walkFiles(full, out);
    } else {
      out.push(full);
    }
  }
  return out;
}

function rewriteFile(filePath, replacer) {
  const ext = filePath.slice(filePath.lastIndexOf('.'));
  if (!TEXT_EXT.has(ext)) return false;
  const before = readFileSync(filePath, 'utf8');
  const after = replacer(before, filePath);
  if (after === before) return false;
  if (!dryRun) writeFileSync(filePath, after);
  console.log(`${dryRun ? '[dry] ' : ''}rewrite ${relative(repoRoot, filePath)}`);
  return true;
}

function moveWebhooksOutbound() {
  const webhooksRoot = join(repoRoot, 'src/modules/webhooks');
  const outbound = join(webhooksRoot, 'outbound');
  if (!existsSync(webhooksRoot)) return;
  if (existsSync(outbound) && existsSync(join(outbound, 'services'))) {
    console.log('outbound already present');
    return;
  }
  console.log(`${dryRun ? '[dry] ' : ''}nest existing webhooks → webhooks/outbound`);
  if (dryRun) return;
  ensureDir(outbound);
  for (const name of WEBHOOKS_OUTBOUND_DIRS) {
    const from = join(webhooksRoot, name);
    if (existsSync(from)) movePath(from, join(outbound, name));
  }
  // Keep old index temporarily; we'll rewrite it as composer.
  const oldIndex = join(webhooksRoot, 'index.js');
  if (existsSync(oldIndex) && !existsSync(join(outbound, 'index.js'))) {
    // Move composition into outbound/index.js then replace root index.
    const content = readFileSync(oldIndex, 'utf8');
    writeFileSync(join(outbound, 'index.js'), content);
  }
}

/**
 * Files under orders/marketplace-ingestion: one extra nesting vs old module root.
 * Old: modules/X -> ../sibling, ../../shared
 * New: modules/orders/marketplace-ingestion/X -> ../../sibling, ../../../shared
 */
function fixMovedOrderIngestionImports(content) {
  let next = content;
  // Sibling modules were ../foo → now ../../foo (except orders itself)
  next = next.replace(
    /from ['"]\.\.\/(commerce-integrations|products|cancellations|returns|shipments|marketplaces|integration-catalog-sync|authorization|inventory|offers|pricing|tenants|webhooks|compatibility|identity|api-keys|audit|mfa|external-id-mapping)\//g,
    `from '../../$1/`,
  );
  // ../orders/ → ../ (same parent module)
  next = next.replace(/from ['"]\.\.\/orders\//g, `from '../`);
  // ../../shared|infrastructure|app|integrations → ../../../...
  next = next.replace(
    /from ['"]\.\.\/\.\.\/(shared|infrastructure|app|integrations|workers)\//g,
    `from '../../../$1/`,
  );
  // JSDoc import() paths
  next = next.replace(
    /import\(['"]\.\.\/\.\.\/(shared|infrastructure|app)\//g,
    `import('../../../$1/`,
  );
  next = next.replace(
    /import\(['"]\.\.\/(commerce-integrations|products|cancellations|returns|shipments|marketplaces|integration-catalog-sync)\//g,
    `import('../../$1/`,
  );
  next = next.replace(/import\(['"]\.\.\/orders\//g, `import('../`);
  return next;
}

/**
 * Files under webhooks/marketplace: one extra nesting.
 * Old refs to marketplace-order-ingestion → orders/marketplace-ingestion
 */
function fixMovedMarketplaceWebhookImports(content) {
  let next = content;
  next = next.replace(
    /from ['"]\.\.\/marketplace-order-ingestion\//g,
    `from '../../orders/marketplace-ingestion/`,
  );
  next = next.replace(
    /import\(['"]\.\.\/marketplace-order-ingestion\//g,
    `import('../../orders/marketplace-ingestion/`,
  );
  next = next.replace(
    /from ['"]\.\.\/(products|marketplaces|commerce-integrations|orders|identity)\//g,
    `from '../../$1/`,
  );
  next = next.replace(
    /from ['"]\.\.\/\.\.\/(shared|infrastructure|app|integrations|workers)\//g,
    `from '../../../$1/`,
  );
  next = next.replace(
    /import\(['"]\.\.\/\.\.\/(shared|infrastructure|app)\//g,
    `import('../../../$1/`,
  );
  next = next.replace(
    /import\(['"]\.\.\/(products|marketplaces|commerce-integrations)\//g,
    `import('../../$1/`,
  );
  return next;
}

/**
 * Files under webhooks/outbound: one extra nesting vs old webhooks root.
 */
function fixOutboundWebhookImports(content) {
  let next = content;
  next = next.replace(
    /from ['"]\.\.\/(authorization|identity|api-keys|audit|mfa|tenants)\//g,
    `from '../../$1/`,
  );
  next = next.replace(
    /from ['"]\.\.\/\.\.\/(shared|infrastructure|app|integrations|workers)\//g,
    `from '../../../$1/`,
  );
  next = next.replace(
    /import\(['"]\.\.\/\.\.\/(shared|infrastructure|app)\//g,
    `import('../../../$1/`,
  );
  next = next.replace(
    /import\(['"]\.\.\/authorization\//g,
    `import('../../authorization/`,
  );
  // Controllers nest were ../../../../nest → need one more ../
  next = next.replace(
    /from ['"]\.\.\/\.\.\/\.\.\/\.\.\/nest\//g,
    `from '../../../../../nest/`,
  );
  next = next.replace(
    /from ['"]\.\.\/\.\.\/\.\.\/\.\.\/shared\//g,
    `from '../../../../../shared/`,
  );
  next = next.replace(
    /from ['"]\.\.\/\.\.\/\.\.\/\.\.\/modules\//g,
    `from '../../../../../modules/`,
  );
  return next;
}

function globalRewrite(content) {
  let next = content;

  next = next.replace(
    /modules\/marketplace-order-ingestion\//g,
    'modules/orders/marketplace-ingestion/',
  );
  next = next.replace(
    /modules\/marketplace-webhook-ingestion\//g,
    'modules/webhooks/marketplace/',
  );

  // Old webhooks layer paths → outbound (avoid double-rewriting marketplace/outbound)
  next = next.replace(
    /modules\/webhooks\/(models|services|repositories|views|public)\//g,
    'modules/webhooks/outbound/$1/',
  );
  next = next.replace(
    /modules\/webhooks\/controllers\//g,
    'modules/webhooks/outbound/controllers/',
  );
  next = next.replace(
    /from ['"](\.\.\/)*modules\/webhooks\/index\.js['"]/g,
    (m) => m, // keep root index
  );
  next = next.replace(
    /modules\/webhooks\/index\.js/g,
    'modules/webhooks/index.js',
  );

  // Test folder path references in docs/scripts
  next = next.replace(
    /tests\/unit\/marketplace-order-ingestion\//g,
    'tests/unit/orders/marketplace-ingestion/',
  );
  next = next.replace(
    /tests\/unit\/marketplace-webhook-ingestion\//g,
    'tests/unit/webhooks/marketplace/',
  );
  next = next.replace(
    /tests\/integration\/orders/marketplace-ingestion/g,
    'tests/integration/orders-marketplace-ingestion',
  );
  next = next.replace(
    /tests\/integration\/webhooks/marketplace/g,
    'tests/integration/webhooks-marketplace',
  );

  return next;
}

function writeComposerIndexes() {
  const webhooksIndex = `import { createWebhooksModule as createOutboundWebhooksModule, createWebhookDispatchService, createWebhookDeliveryService } from './outbound/index.js';
import { createMarketplaceWebhookIngestionModule } from './marketplace/index.js';

export {
  createOutboundWebhooksModule as createWebhooksModule,
  createWebhookDispatchService,
  createWebhookDeliveryService,
  createMarketplaceWebhookIngestionModule,
};

export { MarketplaceWebhookAdapterRegistry } from './marketplace/public/marketplace-webhook-adapter-registry.js';
export { normalizedMarketplaceWebhookEventSchema } from './marketplace/services/normalized-marketplace-webhook-event.schema.js';
`;

  const ordersPublicNote = `
// Marketplace order ingestion lives under ./marketplace-ingestion (not a top-level module).
export { createMarketplaceOrderIngestionModule } from './marketplace-ingestion/index.js';
`;

  if (dryRun) {
    console.log('[dry] write webhooks/index.js composer');
    console.log('[dry] append orders exports');
    return;
  }

  writeFileSync(join(repoRoot, 'src/modules/webhooks/index.js'), webhooksIndex);

  const ordersIndexPath = join(repoRoot, 'src/modules/orders/index.js');
  if (existsSync(ordersIndexPath)) {
    let ordersIndex = readFileSync(ordersIndexPath, 'utf8');
    if (!ordersIndex.includes('marketplace-ingestion')) {
      ordersIndex = `${ordersIndex.trimEnd()}\n${ordersPublicNote}`;
      writeFileSync(ordersIndexPath, ordersIndex);
      console.log('append orders/index.js marketplace-ingestion export');
    }
  }

  // Fix outbound/index.js relative imports after move
  const outboundIndex = join(repoRoot, 'src/modules/webhooks/outbound/index.js');
  if (existsSync(outboundIndex)) {
    rewriteFile(outboundIndex, (c) => fixOutboundWebhookImports(c));
  }
}

function moveTestDirs() {
  const pairs = [
    [
      'tests/unit/marketplace-order-ingestion',
      'tests/unit/orders/marketplace-ingestion',
    ],
    [
      'tests/unit/marketplace-webhook-ingestion',
      'tests/unit/webhooks/marketplace',
    ],
    [
      'tests/integration/orders-marketplace-ingestion.test.js',
      'tests/integration/orders-marketplace-ingestion.test.js',
    ],
    [
      'tests/integration/webhooks-marketplace.test.js',
      'tests/integration/webhooks-marketplace.test.js',
    ],
  ];
  for (const [from, to] of pairs) {
    movePath(join(repoRoot, from), join(repoRoot, to));
  }
}

function main() {
  console.log(dryRun ? 'DRY RUN' : 'Consolidating orders + webhooks…');

  for (const { from, to } of MOVES) {
    movePath(join(repoRoot, from), join(repoRoot, to));
  }

  moveWebhooksOutbound();
  moveTestDirs();

  // Fix imports inside moved trees
  for (const file of walkFiles(join(repoRoot, 'src/modules/orders/marketplace-ingestion'))) {
    if (file.endsWith('.js') || file.endsWith('.md')) {
      rewriteFile(file, (c) => fixMovedOrderIngestionImports(globalRewrite(c)));
    }
  }
  for (const file of walkFiles(join(repoRoot, 'src/modules/webhooks/marketplace'))) {
    if (file.endsWith('.js') || file.endsWith('.md')) {
      rewriteFile(file, (c) => fixMovedMarketplaceWebhookImports(globalRewrite(c)));
    }
  }
  for (const file of walkFiles(join(repoRoot, 'src/modules/webhooks/outbound'))) {
    if (file.endsWith('.js') || file.endsWith('.md')) {
      rewriteFile(file, (c) => fixOutboundWebhookImports(globalRewrite(c)));
    }
  }

  writeComposerIndexes();

  // Global rewrite across repo
  const roots = [
    'src',
    'test',
    'tests',
    'scripts',
    'docs',
    'workers',
    'package.json',
    'eslint.config.js',
    'vitest.config.js',
    '.dependency-cruiser.cjs',
  ];
  for (const root of roots) {
    const full = join(repoRoot, root);
    if (!existsSync(full)) continue;
    if (statSync(full).isFile()) {
      rewriteFile(full, (c) => globalRewrite(c));
      continue;
    }
    for (const file of walkFiles(full)) {
      // Skip already-fixed trees to avoid double depth bumps on shared paths
      const rel = relative(repoRoot, file).replace(/\\/g, '/');
      if (rel.startsWith('src/modules/orders/marketplace-ingestion/')) continue;
      if (rel.startsWith('src/modules/webhooks/marketplace/')) continue;
      if (rel.startsWith('src/modules/webhooks/outbound/')) continue;
      rewriteFile(file, (c) => globalRewrite(c));
    }
  }

  // Remove empty leftover module dirs
  for (const leftover of [
    'src/modules/marketplace-order-ingestion',
    'src/modules/marketplace-webhook-ingestion',
  ]) {
    const full = join(repoRoot, leftover);
    if (existsSync(full)) {
      const files = walkFiles(full);
      if (files.length === 0 || files.every((f) => f.endsWith('README.md'))) {
        console.log(`${dryRun ? '[dry] ' : ''}rm ${leftover}`);
        if (!dryRun) rmSync(full, { recursive: true, force: true });
      } else {
        console.warn(`leftover files in ${leftover}: ${files.length}`);
      }
    }
  }

  console.log('done');
}

main();
