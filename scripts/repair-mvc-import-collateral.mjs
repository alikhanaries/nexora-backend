/**
 * Repair collateral damage from MVC relative-path rewrites:
 * 1) Restore src/infrastructure imports that were wrongly renamed to repositories/
 * 2) Rewrite cross-module relative .../<module>/{domain,application,infrastructure,presentation}/
 */
import { existsSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const LAYER = {
  domain: 'models',
  application: 'services',
  infrastructure: 'repositories',
  presentation: 'views',
};

const MODULES = [
  'api-keys',
  'audit',
  'authorization',
  'cancellations',
  'commerce-integrations',
  'compatibility',
  'external-id-mapping',
  'identity',
  'integration-catalog-sync',
  'inventory',
  'marketplace-order-ingestion',
  'marketplace-webhook-ingestion',
  'marketplaces',
  'mfa',
  'offers',
  'orders',
  'pricing',
  'products',
  'returns',
  'shipments',
  'tenants',
  'webhooks',
];

const INFRA_SUBDIRS = [
  'queue',
  'postgres',
  'redis',
  'http',
  'storage',
  'observability',
  'auth',
  'cache',
];

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

const moduleAlt = MODULES.join('|');
let fixed = 0;

for (const file of [...walk('src'), ...walk('tests'), ...walk('test')]) {
  let content = readFileSync(file, 'utf8');
  const original = content;

  // Restore platform infrastructure imports
  for (const sub of INFRA_SUBDIRS) {
    content = content.replaceAll(
      `/repositories/${sub}/`,
      `/infrastructure/${sub}/`,
    );
    // relative without leading slash variants already covered by /repositories/
  }

  // Cross-module relative: ../other-module/application/ → ../other-module/services/
  for (const [from, to] of Object.entries(LAYER)) {
    content = content.replace(
      new RegExp(`(${moduleAlt})/${from}/`, 'g'),
      `$1/${to}/`,
    );
  }

  if (content !== original) {
    writeFileSync(file, content);
    fixed += 1;
    console.log(file);
  }
}

console.log(`repaired ${fixed} files`);
