/**
 * Phase 4.8 — physical MVC restructure for shipments module only.
 */
import { existsSync, mkdirSync, readdirSync, readFileSync, renameSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = join(fileURLToPath(new URL('.', import.meta.url)), '..');
const moduleRoot = join(repoRoot, 'src/modules/shipments');
const legacyNest = join(repoRoot, 'src/nest/shipments');

function ensureDir(path) {
  if (!existsSync(path)) mkdirSync(path, { recursive: true });
}

function moveFile(from, to) {
  ensureDir(dirname(to));
  if (!existsSync(from)) throw new Error(`Missing source: ${from}`);
  if (existsSync(to)) throw new Error(`Target already exists: ${to}`);
  renameSync(from, to);
}

function moveAllJs(fromDir, toDir) {
  if (!existsSync(fromDir)) return;
  ensureDir(toDir);
  for (const name of readdirSync(fromDir)) {
    if (name.endsWith('.js')) moveFile(join(fromDir, name), join(toDir, name));
  }
}

function removeDirIfEmpty(path) {
  if (existsSync(path) && readdirSync(path).length === 0) {
    rmSync(path, { recursive: true, force: true });
  }
}

function walkFiles(root, filter) {
  const out = [];
  function walk(dir) {
    for (const name of readdirSync(dir)) {
      const full = join(dir, name);
      if (statSync(full).isDirectory()) {
        if (name !== 'node_modules') walk(full);
      } else if (filter(full)) out.push(full);
    }
  }
  walk(root);
  return out;
}

function rewriteShipmentsPaths(content) {
  const pairs = [
    ['modules/shipments/application/', 'modules/shipments/services/'],
    ['modules/shipments/domain/', 'modules/shipments/models/'],
    ['modules/shipments/infrastructure/', 'modules/shipments/repositories/'],
    ['modules/shipments/presentation/shipment.mapper.js', 'modules/shipments/views/shipment.mapper.js'],
    ['modules/shipments/presentation/shipment.schemas.js', 'modules/shipments/views/shipment.schemas.js'],
    ['modules/shipments/presentation/shipment.routes.js', 'modules/shipments/controllers/shipment.routes.js'],
    ['../shipments/application/', '../shipments/services/'],
    ['../shipments/domain/', '../shipments/models/'],
    ['../shipments/infrastructure/', '../shipments/repositories/'],
    ['../../shipments/application/', '../../shipments/services/'],
    ['../../shipments/domain/', '../../shipments/models/'],
    ['../../shipments/infrastructure/', '../../shipments/repositories/'],
    ['../../../modules/shipments/application/', '../../../modules/shipments/services/'],
    ['../../../modules/shipments/domain/', '../../../modules/shipments/models/'],
    ['../../../modules/shipments/infrastructure/', '../../../modules/shipments/repositories/'],
    ['../../../src/modules/shipments/application/', '../../../src/modules/shipments/services/'],
    ['../../../src/modules/shipments/domain/', '../../../src/modules/shipments/models/'],
    ['../../../src/modules/shipments/infrastructure/', '../../../src/modules/shipments/repositories/'],
    ['../../../../modules/shipments/application/', '../../../../modules/shipments/services/'],
    ['../../../../modules/shipments/domain/', '../../../../modules/shipments/models/'],
    ['../../../../modules/shipments/infrastructure/', '../../../../modules/shipments/repositories/'],
    ["from './shipments/shipments.module.js'", "from '../modules/shipments/public/nest-shipments-module.js'"],
    ["from '../shipments/shipments.module.js'", "from '../../modules/shipments/public/nest-shipments-module.js'"],
    ["from '../shipments/shipments.service.js'", "from '../../modules/shipments/public/nest-shipments-service.js'"],
  ];
  let next = content;
  for (const [from, to] of pairs) next = next.split(from).join(to);
  return next;
}

function rewriteInsideShipmentsModule(content) {
  return content
    .replaceAll("from './application/", "from './services/")
    .replaceAll("from '../application/", "from '../services/")
    .replaceAll("from './domain/", "from './models/")
    .replaceAll("from '../domain/", "from '../models/")
    .replaceAll("from './infrastructure/", "from './repositories/")
    .replaceAll("from '../infrastructure/", "from '../repositories/")
    .replaceAll("from './presentation/", "from './views/")
    .replaceAll("from '../presentation/", "from '../views/")
    .replaceAll("from './shipment-dto.js'", "from '../views/shipment-dto.js'")
    .replaceAll("from './shipment.mapper.js'", "from '../views/shipment.mapper.js'")
    .replaceAll("from './shipment.schemas.js'", "from '../views/shipment.schemas.js'");
}

function patchNestAdapter(content) {
  return content
    .replace(
      "from '../../modules/shipments/views/shipment.schemas.js'",
      "from '../../views/shipment.schemas.js'",
    )
    .replace(
      "from '../../modules/shipments/views/shipment.mapper.js'",
      "from '../../views/shipment.mapper.js'",
    )
    .replace("from '../../shared/", "from '../../../../shared/")
    .replace("from '../common/", "from '../../../../nest/common/")
    .replace("from '../domain/", "from '../../../../nest/domain/");
}

ensureDir(join(moduleRoot, 'models'));
ensureDir(join(moduleRoot, 'repositories'));
ensureDir(join(moduleRoot, 'views'));
ensureDir(join(moduleRoot, 'controllers/nest'));
ensureDir(join(moduleRoot, 'services'));

const domainDir = join(moduleRoot, 'domain');
if (existsSync(join(domainDir, 'shipment-repository.port.js'))) {
  moveFile(
    join(domainDir, 'shipment-repository.port.js'),
    join(moduleRoot, 'repositories/shipment-repository.port.js'),
  );
}
moveAllJs(domainDir, join(moduleRoot, 'models'));
moveAllJs(join(moduleRoot, 'application'), join(moduleRoot, 'services'));
moveAllJs(join(moduleRoot, 'infrastructure'), join(moduleRoot, 'repositories'));

if (existsSync(join(moduleRoot, 'services/shipment-dto.js'))) {
  moveFile(join(moduleRoot, 'services/shipment-dto.js'), join(moduleRoot, 'views/shipment-dto.js'));
}

const presentationDir = join(moduleRoot, 'presentation');
if (existsSync(join(presentationDir, 'shipment.mapper.js'))) {
  moveFile(join(presentationDir, 'shipment.mapper.js'), join(moduleRoot, 'views/shipment.mapper.js'));
}
if (existsSync(join(presentationDir, 'shipment.schemas.js'))) {
  moveFile(join(presentationDir, 'shipment.schemas.js'), join(moduleRoot, 'views/shipment.schemas.js'));
}
if (existsSync(join(presentationDir, 'shipment.routes.js'))) {
  moveFile(join(presentationDir, 'shipment.routes.js'), join(moduleRoot, 'controllers/shipment.routes.js'));
}

if (existsSync(legacyNest)) {
  for (const name of readdirSync(legacyNest)) {
    if (name.endsWith('.js')) {
      moveFile(join(legacyNest, name), join(moduleRoot, 'controllers/nest', name));
    }
  }
  removeDirIfEmpty(legacyNest);
}

removeDirIfEmpty(domainDir);
removeDirIfEmpty(join(moduleRoot, 'application'));
removeDirIfEmpty(join(moduleRoot, 'infrastructure'));
removeDirIfEmpty(presentationDir);

const scanRoots = [join(repoRoot, 'src'), join(repoRoot, 'tests'), join(repoRoot, 'test')];
const files = [];
for (const root of scanRoots) {
  if (!existsSync(root)) continue;
  files.push(...walkFiles(root, (p) => p.endsWith('.js')));
}

for (const file of files) {
  const original = readFileSync(file, 'utf8');
  let updated = rewriteShipmentsPaths(original);
  if (file.includes(`${join('modules', 'shipments')}`)) {
    updated = rewriteInsideShipmentsModule(updated);
  }
  if (file.includes(join('shipments', 'controllers', 'nest'))) {
    updated = patchNestAdapter(updated);
  }
  if (file.includes(join('shipments', 'controllers', 'shipment.routes.js'))) {
    updated = updated
      .replace("from './shipment.mapper.js'", "from '../views/shipment.mapper.js'")
      .replace("from './shipment.schemas.js'", "from '../views/shipment.schemas.js'");
  }
  if (updated !== original) writeFileSync(file, updated, 'utf8');
}

console.log('Phase 4.8 shipments MVC restructure complete.');
