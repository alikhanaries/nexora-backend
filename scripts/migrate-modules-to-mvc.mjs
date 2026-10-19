/**
 * Physical MVC migration for remaining DDD modules:
 *   domain → models, application → services,
 *   infrastructure → repositories, presentation → views
 * Nest feature modules → modules/<name>/controllers/nest/
 *
 * Usage: node scripts/migrate-modules-to-mvc.mjs [--dry-run]
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

const MODULES = [
  'api-keys',
  'audit',
  'authorization',
  'commerce-integrations',
  'compatibility',
  'external-id-mapping',
  'identity',
  'integration-catalog-sync',
  'inventory',
  'marketplaces',
  'mfa',
  'offers',
  'pricing',
  'products',
  'tenants',
  'webhooks',
];

/** Nest dirs under src/app that belong to a business module. */
const NEST_FEATURE_MOVES = [
  { nest: 'api-keys', module: 'api-keys' },
  { nest: 'audit', module: 'audit' },
  { nest: 'authorization', module: 'authorization' },
  { nest: 'commerce-integrations', module: 'commerce-integrations' },
  { nest: 'inventory', module: 'inventory' },
  { nest: 'marketplaces', module: 'marketplaces' },
  { nest: 'mfa', module: 'mfa' },
  { nest: 'offers', module: 'offers' },
  { nest: 'pricing', module: 'pricing' },
  { nest: 'products', module: 'products' },
  { nest: 'tenants', module: 'tenants' },
  { nest: 'webhooks', module: 'webhooks' },
  { nest: 'webhook-subscriptions', module: 'webhooks' },
];

const LAYER_MAP = {
  domain: 'models',
  application: 'services',
  infrastructure: 'repositories',
  presentation: 'views',
};

function ensureDir(path) {
  if (!existsSync(path) && !dryRun) mkdirSync(path, { recursive: true });
}

function movePath(from, to) {
  if (!existsSync(from)) return;
  console.log(`${dryRun ? '[dry] ' : ''}mv ${relative(repoRoot, from)} → ${relative(repoRoot, to)}`);
  if (dryRun) return;
  ensureDir(dirname(to));
  if (existsSync(to) && statSync(to).isDirectory()) {
    for (const name of readdirSync(from)) {
      const src = join(from, name);
      const dest = join(to, name);
      if (existsSync(dest)) {
        console.warn(`  skip exists ${relative(repoRoot, dest)}`);
        continue;
      }
      try {
        renameSync(src, dest);
      }
      catch {
        cpSync(src, dest, { recursive: true });
        rmSync(src, { recursive: true, force: true });
      }
    }
    if (readdirSync(from).length === 0) rmSync(from, { recursive: true, force: true });
    return;
  }
  try {
    renameSync(from, to);
  }
  catch (error) {
    console.warn(`  rename failed (${error.code}); using copy+delete`);
    cpSync(from, to, { recursive: true });
    rmSync(from, { recursive: true, force: true });
  }
}

function listFiles(dir, acc = []) {
  if (!existsSync(dir)) return acc;
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) {
      if (name === 'node_modules' || name === 'dist' || name === '.git') continue;
      listFiles(full, acc);
    }
    else if (/\.(js|mjs|cjs|md)$/.test(name)) acc.push(full);
  }
  return acc;
}

/** Rewrite modules/<name>/<layer>/ path segments (safe for any file). */
function rewriteModulesPathLayers(content) {
  let next = content;
  for (const [from, to] of Object.entries(LAYER_MAP)) {
    next = next.replace(
      new RegExp(`(modules/[a-z0-9-]+/)${from}(/)`, 'g'),
      `$1${to}$2`,
    );
  }
  return next;
}

/** Relative layer imports — only apply inside src/modules/** files. */
function rewriteRelativeLayersInsideModule(content) {
  let next = content;
  for (const [from, to] of Object.entries(LAYER_MAP)) {
    next = next.replace(new RegExp(`(\\./)${from}/`, 'g'), `$1${to}/`);
    next = next.replace(new RegExp(`(\\.\\./)${from}/`, 'g'), `$1${to}/`);
    next = next.replace(new RegExp(`(\\.\\./\\.\\./)${from}/`, 'g'), `$1${to}/`);
    next = next.replace(new RegExp(`(\\.\\./\\.\\./\\.\\./)${from}/`, 'g'), `$1${to}/`);
    next = next.replace(new RegExp(`(\\.\\./\\.\\./\\.\\./\\.\\./)${from}/`, 'g'), `$1${to}/`);
  }
  return next;
}

function rewriteMovedNestFile(originalContent) {
  let next = originalContent;
  // ../../modules/<this-or-other>/<layer>/ → ../../<mvc-layer>/ when same module folder
  // We don't know module name easily from content; apply:
  // ../../modules/X/presentation/ → ../../views/
  // ../../modules/X/application/ → ../../services/
  // ../../modules/X/domain/ → ../../models/
  // ../../modules/X/infrastructure/ → ../../repositories/
  // ../../modules/X/public/ → ../../public/
  // ../../modules/OTHER/... → ../../../OTHER/...
  next = next.replace(
    /from ['"](\.\.\/\.\.\/)modules\/([a-z0-9-]+)\/(domain|application|infrastructure|presentation|public)\/([^'"]+)['"]/g,
    (full, _dots, mod, layer, rest) => {
      const mvc = LAYER_MAP[layer] ?? layer;
      // Prefer sibling MVC folders (controllers/nest → ../../views)
      return `from '../../${mvc}/${rest}'`;
    },
  );
  // Remaining ../../modules/X/foo → ../../../X/foo
  next = next.replace(
    /from ['"]\.\.\/\.\.\/modules\/([a-z0-9-]+)\/([^'"]+)['"]/g,
    (_m, mod, rest) => `from '../../../${mod}/${rest}'`,
  );
  // ../../shared → ../../../../shared
  next = next.replaceAll("from '../../shared/", "from '../../../../shared/");
  next = next.replaceAll('from "../../shared/', 'from "../../../../shared/');
  // ../common (nest common) → ../../../../nest/common? From controllers/nest, nest common is ../../../common under nest — actually nest common is at src/app/common
  // From src/modules/X/controllers/nest → src/app/common is ../../../../nest/common
  next = next.replaceAll("from '../common/", "from '../../../../app/common/");
  next = next.replaceAll('from "../common/', 'from "../../../../app/common/');
  next = next.replaceAll("from '../../common/", "from '../../../../app/common/");
  next = next.replaceAll('from "../../common/', 'from "../../../../app/common/');
  // ../domain (core-domain tokens) was src/app/domain
  next = next.replaceAll("from '../domain/", "from '../../../../app/di/");
  next = next.replaceAll('from "../domain/', 'from "../../../../app/di/');
  next = next.replaceAll("from '../../domain/", "from '../../../../app/di/");
  next = next.replaceAll('from "../../domain/', 'from "../../../../app/di/');
  return next;
}

// 1) Rename layers
for (const moduleName of MODULES) {
  const root = join(repoRoot, 'src/modules', moduleName);
  if (!existsSync(root)) continue;
  for (const [from, to] of Object.entries(LAYER_MAP)) {
    movePath(join(root, from), join(root, to));
  }
}

// 2) Move Nest feature folders (capture file contents first for rewrite after move)
const nestFileRewrites = [];
for (const { nest, module } of NEST_FEATURE_MOVES) {
  const fromDir = join(repoRoot, 'src/app', nest);
  if (!existsSync(fromDir)) continue;
  const toDir = join(repoRoot, 'src/modules', module, 'controllers', 'nest');
  ensureDir(toDir);
  for (const name of readdirSync(fromDir)) {
    const src = join(fromDir, name);
    if (!statSync(src).isFile()) {
      // nested dirs uncommon; move recursively via movePath
      movePath(src, join(toDir, name));
      continue;
    }
    const dest = join(toDir, name);
    const original = readFileSync(src, 'utf8');
    const rewritten = rewriteMovedNestFile(original);
    console.log(`${dryRun ? '[dry] ' : ''}move+rewrite nest/${nest}/${name}`);
    if (!dryRun) {
      if (existsSync(dest)) {
        console.warn(`  skip exists ${relative(repoRoot, dest)}`);
      }
      else {
        writeFileSync(dest, rewritten, 'utf8');
        rmSync(src);
      }
    }
    else {
      nestFileRewrites.push(relative(repoRoot, dest));
    }
  }
  if (!dryRun && existsSync(fromDir) && readdirSync(fromDir).length === 0) {
    rmSync(fromDir, { recursive: true, force: true });
  }
}

// 3) Rewrite remaining source imports (module layer paths + app.module)
const appModulePath = join(repoRoot, 'src/app/app.module.js');
if (existsSync(appModulePath)) {
  let content = readFileSync(appModulePath, 'utf8');
  const map = [
    ["./products/products.module.js", "../modules/products/controllers/nest/products.module.js"],
    ["./pricing/pricing.module.js", "../modules/pricing/controllers/nest/pricing.module.js"],
    ["./offers/offers.module.js", "../modules/offers/controllers/nest/offers.module.js"],
    ["./inventory/inventory.module.js", "../modules/inventory/controllers/nest/inventory.module.js"],
    ["./commerce-integrations/commerce-integrations.module.js", "../modules/commerce-integrations/controllers/nest/commerce-integrations.module.js"],
    ["./marketplaces/marketplaces.module.js", "../modules/marketplaces/controllers/nest/marketplaces.module.js"],
    ["./webhooks/webhooks.module.js", "../modules/webhooks/outbound/controllers/nest/webhooks.module.js"],
    ["./webhook-subscriptions/webhook-subscriptions.module.js", "../modules/webhooks/outbound/controllers/nest/webhook-subscriptions.module.js"],
    ["./api-keys/api-keys.module.js", "../modules/api-keys/controllers/nest/api-keys.module.js"],
    ["./audit/audit.module.js", "../modules/audit/controllers/nest/audit.module.js"],
    ["./authorization/authorization.module.js", "../modules/authorization/controllers/nest/authorization.module.js"],
    ["./mfa/mfa.module.js", "../modules/mfa/controllers/nest/mfa.module.js"],
    ["./tenants/tenants.module.js", "../modules/tenants/controllers/nest/tenants.module.js"],
  ];
  const before = content;
  for (const [a, b] of map) content = content.replaceAll(a, b);
  if (content !== before) {
    console.log(`${dryRun ? '[dry] ' : ''}rewrite src/app/app.module.js`);
    if (!dryRun) writeFileSync(appModulePath, content, 'utf8');
  }
}

let rewritten = 0;
const scanFiles = listFiles(join(repoRoot, 'src'))
  .concat(listFiles(join(repoRoot, 'tests')))
  .concat(listFiles(join(repoRoot, 'test')));
for (const file of scanFiles) {
  const rel = relative(repoRoot, file).replace(/\\/g, '/');
  if (rel.includes('/controllers/nest/')) continue;
  const original = readFileSync(file, 'utf8');
  let next = rewriteModulesPathLayers(original);
  if (rel.startsWith('src/modules/')) {
    next = rewriteRelativeLayersInsideModule(next);
  }
  if (next !== original) {
    rewritten += 1;
    console.log(`${dryRun ? '[dry] ' : ''}rewrite ${rel}`);
    if (!dryRun) writeFileSync(file, next, 'utf8');
  }
}

console.log(`Layer import rewrites: ${rewritten}. dryRun=${dryRun}`);
if (dryRun) console.log('Dry-run nest targets:', nestFileRewrites.slice(0, 20));
