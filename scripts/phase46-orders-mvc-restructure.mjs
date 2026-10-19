/**
 * One-shot physical MVC restructure for src/modules/orders (Phase 4.6).
 * Run from repo root: node scripts/phase46-orders-mvc-restructure.mjs
 */
import { cpSync, existsSync, mkdirSync, readdirSync, readFileSync, renameSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = join(fileURLToPath(new URL('.', import.meta.url)), '..');
const ordersRoot = join(repoRoot, 'src/modules/orders');
const nestOrders = join(repoRoot, 'src/app/orders');

function ensureDir(path) {
  if (!existsSync(path)) {
    mkdirSync(path, { recursive: true });
  }
}

function moveFile(from, to) {
  ensureDir(dirname(to));
  if (!existsSync(from)) {
    throw new Error(`Missing source: ${from}`);
  }
  if (existsSync(to)) {
    throw new Error(`Target already exists: ${to}`);
  }
  renameSync(from, to);
}

function moveAllJs(fromDir, toDir) {
  if (!existsSync(fromDir)) {
    return;
  }
  ensureDir(toDir);
  for (const name of readdirSync(fromDir)) {
    if (!name.endsWith('.js')) {
      continue;
    }
    moveFile(join(fromDir, name), join(toDir, name));
  }
}

function removeDirIfEmpty(path) {
  if (!existsSync(path)) {
    return;
  }
  const entries = readdirSync(path);
  if (entries.length === 0) {
    rmSync(path, { recursive: true, force: true });
  }
}

/** @param {string} root */
function walkFiles(root, filter) {
  /** @type {string[]} */
  const out = [];
  /** @param {string} dir */
  function walk(dir) {
    for (const name of readdirSync(dir)) {
      const full = join(dir, name);
      const st = statSync(full);
      if (st.isDirectory()) {
        if (name === 'node_modules') {
          continue;
        }
        walk(full);
      } else if (filter(full)) {
        out.push(full);
      }
    }
  }
  walk(root);
  return out;
}

function applyReplacements(content) {
  let next = content;
  const pairs = [
    ['modules/orders/application/', 'modules/orders/services/'],
    ['modules/orders/domain/', 'modules/orders/models/'],
    ['modules/orders/infrastructure/', 'modules/orders/repositories/'],
    ['modules/orders/presentation/order.mapper.js', 'modules/orders/views/order.mapper.js'],
    ['modules/orders/presentation/order.schemas.js', 'modules/orders/views/order.schemas.js'],
    ['modules/orders/presentation/order.routes.js', 'modules/orders/controllers/order.routes.js'],
    ['../../orders/application/', '../../orders/services/'],
    ['../../orders/domain/', '../../orders/models/'],
    ['../../orders/infrastructure/', '../../orders/repositories/'],
    ['../orders/application/', '../orders/services/'],
    ['../orders/domain/', '../orders/models/'],
    ['../orders/infrastructure/', '../orders/repositories/'],
    ["from './application/", "from './services/"],
    ["from '../application/", "from '../services/"],
    ["from './presentation/", "from './controllers/"],
    ["from '../presentation/", "from '../views/"],
    ["from './infrastructure/", "from './repositories/"],
    ["from '../infrastructure/", "from '../repositories/"],
    ["from './domain/", "from './models/"],
    ["from '../domain/", "from '../models/"],
    ["from './order-dto.js'", "from '../views/order-dto.js'"],
    ["from './order.mapper.js'", "from '../views/order.mapper.js'"],
    ["from './order.schemas.js'", "from '../views/order.schemas.js'"],
    ["import('../domain/", "import('../models/"],
    ["import('../../domain/", "import('../../models/"],
    ['./orders/orders.module.js', './modules/orders/controllers/nest/orders.module.js'],
    ["from '../orders/orders.service.js'", "from '../../modules/orders/controllers/nest/orders.service.js'"],
    ["from '../orders/orders.module.js'", "from '../../modules/orders/controllers/nest/orders.module.js'"],
  ];
  for (const [from, to] of pairs) {
    next = next.split(from).join(to);
  }
  return next;
}

function patchNestControllerNestPaths(content) {
  return content
    .replace(
      "from '../../modules/orders/views/order.schemas.js'",
      "from '../../views/order.schemas.js'",
    )
    .replace(
      "from '../../modules/orders/views/order.mapper.js'",
      "from '../../views/order.mapper.js'",
    )
    .replace("from '../cancellations/", "from '../../../../nest/cancellations/")
    .replace("from '../common/", "from '../../../../app/common/")
    .replace("from '../domain/", "from '../../../../app/di/");
}

// --- physical moves ---
ensureDir(join(ordersRoot, 'models'));
ensureDir(join(ordersRoot, 'repositories'));
ensureDir(join(ordersRoot, 'views'));
ensureDir(join(ordersRoot, 'controllers/nest'));

const domainDir = join(ordersRoot, 'domain');
if (existsSync(join(domainDir, 'order-repository.port.js'))) {
  moveFile(
    join(domainDir, 'order-repository.port.js'),
    join(ordersRoot, 'repositories/order-repository.port.js'),
  );
}
moveAllJs(domainDir, join(ordersRoot, 'models'));

const infraDir = join(ordersRoot, 'infrastructure');
moveAllJs(infraDir, join(ordersRoot, 'repositories'));

moveAllJs(join(ordersRoot, 'application'), join(ordersRoot, 'services'));

if (existsSync(join(ordersRoot, 'services/order-dto.js'))) {
  moveFile(join(ordersRoot, 'services/order-dto.js'), join(ordersRoot, 'views/order-dto.js'));
}

const presentationDir = join(ordersRoot, 'presentation');
if (existsSync(join(presentationDir, 'order.mapper.js'))) {
  moveFile(join(presentationDir, 'order.mapper.js'), join(ordersRoot, 'views/order.mapper.js'));
}
if (existsSync(join(presentationDir, 'order.schemas.js'))) {
  moveFile(join(presentationDir, 'order.schemas.js'), join(ordersRoot, 'views/order.schemas.js'));
}
if (existsSync(join(presentationDir, 'order.routes.js'))) {
  moveFile(join(presentationDir, 'order.routes.js'), join(ordersRoot, 'controllers/order.routes.js'));
}

if (existsSync(nestOrders)) {
  for (const name of readdirSync(nestOrders)) {
    if (!name.endsWith('.js')) {
      continue;
    }
    moveFile(join(nestOrders, name), join(ordersRoot, 'controllers/nest', name));
  }
  removeDirIfEmpty(nestOrders);
}

removeDirIfEmpty(domainDir);
removeDirIfEmpty(infraDir);
removeDirIfEmpty(presentationDir);
removeDirIfEmpty(join(ordersRoot, 'application'));

// --- global import rewrites ---
const roots = [
  join(repoRoot, 'src'),
  join(repoRoot, 'tests'),
  join(repoRoot, 'docs/architecture/function-based-mvc-migration.md'),
  join(repoRoot, 'docs/architecture/module-boundaries.md'),
  join(repoRoot, 'docs/API_ROUTE_INVENTORY.md'),
];

/** @type {string[]} */
const files = [];
for (const root of roots) {
  if (!existsSync(root)) {
    continue;
  }
  if (root.endsWith('.md')) {
    files.push(root);
  } else {
    files.push(...walkFiles(root, (p) => p.endsWith('.js') || p.endsWith('.md')));
  }
}

for (const file of files) {
  const original = readFileSync(file, 'utf8');
  let updated = applyReplacements(original);
  if (file.includes('modules\\orders\\controllers\\nest') || file.includes('modules/orders/controllers/nest')) {
    updated = patchNestControllerNestPaths(updated);
  }
  if (file.endsWith('controllers/order.routes.js') || file.includes('controllers\\order.routes.js')) {
    updated = updated
      .replace("from '../views/order.mapper.js'", "from '../views/order.mapper.js'")
      .replace("from './order.mapper.js'", "from '../views/order.mapper.js'")
      .replace("from './order.schemas.js'", "from '../views/order.schemas.js'");
  }
  if (updated !== original) {
    writeFileSync(file, updated, 'utf8');
  }
}

console.log('Phase 4.6 orders MVC restructure: file moves and import rewrites complete.');
