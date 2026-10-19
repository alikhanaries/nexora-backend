/**
 * Phase 4.9 — physical MVC restructure for returns module only.
 */
import { existsSync, mkdirSync, readdirSync, readFileSync, renameSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = join(fileURLToPath(new URL('.', import.meta.url)), '..');
const moduleRoot = join(repoRoot, 'src/modules/returns');
const legacyNest = join(repoRoot, 'src/nest/returns');

function ensureDir(path) {
  if (!existsSync(path)) mkdirSync(path, { recursive: true });
}

function moveFile(from, to) {
  ensureDir(dirname(to));
  if (!existsSync(from)) throw new Error(`Missing source: ${from}`);
  if (existsSync(to)) throw new Error(`Target already exists: ${to}`);
  renameSync(from, to);
}

function moveAllJsRecursive(fromDir, toDir) {
  if (!existsSync(fromDir)) return;
  ensureDir(toDir);
  for (const name of readdirSync(fromDir)) {
    const from = join(fromDir, name);
    if (statSync(from).isDirectory()) {
      moveAllJsRecursive(from, join(toDir, name));
      removeDirIfEmpty(from);
    } else if (name.endsWith('.js')) {
      moveFile(from, join(toDir, name));
    }
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

function rewriteReturnsPaths(content) {
  const pairs = [
    ['modules/returns/application/', 'modules/returns/services/'],
    ['modules/returns/domain/', 'modules/returns/models/'],
    ['modules/returns/infrastructure/', 'modules/returns/repositories/'],
    ['modules/returns/presentation/return.mapper.js', 'modules/returns/views/return.mapper.js'],
    ['modules/returns/presentation/return.schemas.js', 'modules/returns/views/return.schemas.js'],
    ['modules/returns/presentation/return.routes.js', 'modules/returns/controllers/return.routes.js'],
    ['../returns/application/', '../returns/services/'],
    ['../returns/domain/', '../returns/models/'],
    ['../returns/infrastructure/', '../returns/repositories/'],
    ['../../returns/application/', '../../returns/services/'],
    ['../../returns/domain/', '../../returns/models/'],
    ['../../returns/infrastructure/', '../../returns/repositories/'],
    ['../../../modules/returns/application/', '../../../modules/returns/services/'],
    ['../../../modules/returns/domain/', '../../../modules/returns/models/'],
    ['../../../modules/returns/infrastructure/', '../../../modules/returns/repositories/'],
    ['../../../src/modules/returns/application/', '../../../src/modules/returns/services/'],
    ['../../../src/modules/returns/domain/', '../../../src/modules/returns/models/'],
    ['../../../src/modules/returns/infrastructure/', '../../../src/modules/returns/repositories/'],
    ['../../../../modules/returns/application/', '../../../../modules/returns/services/'],
    ['../../../../modules/returns/domain/', '../../../../modules/returns/models/'],
    ['../../../../modules/returns/infrastructure/', '../../../../modules/returns/repositories/'],
    ["from './returns/returns.module.js'", "from '../modules/returns/public/nest-returns-module.js'"],
    ["from '../returns/returns.module.js'", "from '../../modules/returns/public/nest-returns-module.js'"],
    ["from '../returns/returns.service.js'", "from '../../modules/returns/public/nest-returns-service.js'"],
  ];
  let next = content;
  for (const [from, to] of pairs) next = next.split(from).join(to);
  return next;
}

function rewriteInsideReturnsModule(content) {
  return content
    .replaceAll("from './application/", "from './services/")
    .replaceAll("from '../application/", "from '../services/")
    .replaceAll("from './domain/", "from './models/")
    .replaceAll("from '../domain/", "from '../models/")
    .replaceAll("from './infrastructure/", "from './repositories/")
    .replaceAll("from '../infrastructure/", "from '../repositories/")
    .replaceAll("from './presentation/", "from './views/")
    .replaceAll("from '../presentation/", "from '../views/")
    .replaceAll("from './return-dto.js'", "from '../views/return-dto.js'")
    .replaceAll("from './return.mapper.js'", "from '../views/return.mapper.js'")
    .replaceAll("from './return.schemas.js'", "from '../views/return.schemas.js'");
}

function patchNestAdapter(content) {
  return content
    .replace("from '../../modules/returns/views/return.schemas.js'", "from '../../views/return.schemas.js'")
    .replace("from '../../modules/returns/views/return.mapper.js'", "from '../../views/return.mapper.js'")
    .replace("from '../../modules/orders/views/order.schemas.js'", "from '../../views/return.schemas.js'")
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
if (existsSync(join(domainDir, 'return-repository.port.js'))) {
  moveFile(join(domainDir, 'return-repository.port.js'), join(moduleRoot, 'repositories/return-repository.port.js'));
}
moveAllJsRecursive(domainDir, join(moduleRoot, 'models'));
moveAllJsRecursive(join(moduleRoot, 'application'), join(moduleRoot, 'services'));
moveAllJsRecursive(join(moduleRoot, 'infrastructure'), join(moduleRoot, 'repositories'));

if (existsSync(join(moduleRoot, 'services/return-dto.js'))) {
  moveFile(join(moduleRoot, 'services/return-dto.js'), join(moduleRoot, 'views/return-dto.js'));
}

const presentationDir = join(moduleRoot, 'presentation');
if (existsSync(join(presentationDir, 'return.mapper.js'))) {
  moveFile(join(presentationDir, 'return.mapper.js'), join(moduleRoot, 'views/return.mapper.js'));
}
if (existsSync(join(presentationDir, 'return.schemas.js'))) {
  moveFile(join(presentationDir, 'return.schemas.js'), join(moduleRoot, 'views/return.schemas.js'));
}
if (existsSync(join(presentationDir, 'return.routes.js'))) {
  moveFile(join(presentationDir, 'return.routes.js'), join(moduleRoot, 'controllers/return.routes.js'));
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
  let updated = rewriteReturnsPaths(original);
  if (file.includes(`${join('modules', 'returns')}`)) {
    updated = rewriteInsideReturnsModule(updated);
  }
  if (file.includes(join('returns', 'controllers', 'nest'))) {
    updated = patchNestAdapter(updated);
  }
  if (file.includes(join('returns', 'controllers', 'return.routes.js'))) {
    updated = updated
      .replace("from './return.mapper.js'", "from '../views/return.mapper.js'")
      .replace("from './return.schemas.js'", "from '../views/return.schemas.js'");
  }
  if (updated !== original) writeFileSync(file, updated, 'utf8');
}

console.log('Phase 4.9 returns MVC restructure complete.');
