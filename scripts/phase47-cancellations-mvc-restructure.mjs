/**
 * Phase 4.7 — physical MVC restructure for cancellations module only.
 */
import { existsSync, mkdirSync, readdirSync, readFileSync, renameSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = join(fileURLToPath(new URL('.', import.meta.url)), '..');
const moduleRoot = join(repoRoot, 'src/modules/cancellations');
const legacyNest = join(repoRoot, 'src/app/cancellations');

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
    if (name.endsWith('.js')) {
      moveFile(join(fromDir, name), join(toDir, name));
    }
  }
}

function removeDirIfEmpty(path) {
  if (!existsSync(path)) {
    return;
  }
  if (readdirSync(path).length === 0) {
    rmSync(path, { recursive: true, force: true });
  }
}

/** @param {string} root @param {(p: string) => boolean} filter */
function walkFiles(root, filter) {
  /** @type {string[]} */
  const out = [];
  function walk(dir) {
    for (const name of readdirSync(dir)) {
      const full = join(dir, name);
      if (statSync(full).isDirectory()) {
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

/** @param {string} content */
function rewriteCancellationsPaths(content) {
  const pairs = [
    ['modules/cancellations/application/', 'modules/cancellations/services/'],
    ['modules/cancellations/domain/', 'modules/cancellations/models/'],
    ['modules/cancellations/infrastructure/', 'modules/cancellations/repositories/'],
    [
      'modules/cancellations/presentation/cancellation.mapper.js',
      'modules/cancellations/views/cancellation.mapper.js',
    ],
    [
      'modules/cancellations/presentation/cancellation.schemas.js',
      'modules/cancellations/views/cancellation.schemas.js',
    ],
    [
      'modules/cancellations/presentation/cancellation.routes.js',
      'modules/cancellations/controllers/cancellation.routes.js',
    ],
    ['../cancellations/application/', '../cancellations/services/'],
    ['../cancellations/domain/', '../cancellations/models/'],
    ['../cancellations/infrastructure/', '../cancellations/repositories/'],
    ['../../cancellations/application/', '../../cancellations/services/'],
    ['../../cancellations/domain/', '../../cancellations/models/'],
    ['../../cancellations/infrastructure/', '../../cancellations/repositories/'],
    ['../../../modules/cancellations/application/', '../../../modules/cancellations/services/'],
    ['../../../modules/cancellations/domain/', '../../../modules/cancellations/models/'],
    ['../../../modules/cancellations/infrastructure/', '../../../modules/cancellations/repositories/'],
    ['../../../src/modules/cancellations/application/', '../../../src/modules/cancellations/services/'],
    ['../../../src/modules/cancellations/domain/', '../../../src/modules/cancellations/models/'],
    ['../../../src/modules/cancellations/infrastructure/', '../../../src/modules/cancellations/repositories/'],
    ['../../../../modules/cancellations/application/', '../../../../modules/cancellations/services/'],
    ['../../../../modules/cancellations/domain/', '../../../../modules/cancellations/models/'],
    ['../../../../modules/cancellations/infrastructure/', '../../../../modules/cancellations/repositories/'],
    ['./cancellations/cancellations.module.js', './modules/cancellations/controllers/nest/cancellations.module.js'],
    ["from '../cancellations/cancellations.module.js'", "from '../../modules/cancellations/controllers/nest/cancellations.module.js'"],
    ["from '../cancellations/cancellations.service.js'", "from '../../modules/cancellations/controllers/nest/cancellations.service.js'"],
    ["from '../../../../nest/cancellations/cancellations.module.js'", "from '../../../../modules/cancellations/controllers/nest/cancellations.module.js'"],
    ["from '../../../../nest/cancellations/cancellations.service.js'", "from '../../../../modules/cancellations/controllers/nest/cancellations.service.js'"],
  ];
  let next = content;
  for (const [from, to] of pairs) {
    next = next.split(from).join(to);
  }
  return next;
}

function rewriteInsideCancellationsModule(content) {
  return content
    .replaceAll("from './application/", "from './services/")
    .replaceAll("from '../application/", "from '../services/")
    .replaceAll("from './domain/", "from './models/")
    .replaceAll("from '../domain/", "from '../models/")
    .replaceAll("from './infrastructure/", "from './repositories/")
    .replaceAll("from '../infrastructure/", "from '../repositories/")
    .replaceAll("from './presentation/", "from './views/")
    .replaceAll("from '../presentation/", "from '../views/")
    .replaceAll("from './cancellation-dto.js'", "from '../views/cancellation-dto.js'")
    .replaceAll("from './cancellation.mapper.js'", "from '../views/cancellation.mapper.js'")
    .replaceAll("from './cancellation.schemas.js'", "from '../views/cancellation.schemas.js'");
}

function patchNestAdapter(content) {
  return content
    .replace(
      "from '../../modules/cancellations/views/cancellation.schemas.js'",
      "from '../../views/cancellation.schemas.js'",
    )
    .replace(
      "from '../../modules/cancellations/views/cancellation.mapper.js'",
      "from '../../views/cancellation.mapper.js'",
    )
    .replace(
      "from '../../../../shared/",
      "from '../../../../shared/",
    )
    .replace("from '../../shared/", "from '../../../../shared/")
    .replace("from '../common/", "from '../../../../app/common/")
    .replace("from '../domain/", "from '../../../../app/di/");
}

// --- moves ---
ensureDir(join(moduleRoot, 'models'));
ensureDir(join(moduleRoot, 'repositories'));
ensureDir(join(moduleRoot, 'views'));
ensureDir(join(moduleRoot, 'controllers/nest'));
ensureDir(join(moduleRoot, 'services'));

const domainDir = join(moduleRoot, 'domain');
if (existsSync(join(domainDir, 'cancellation-repository.port.js'))) {
  moveFile(
    join(domainDir, 'cancellation-repository.port.js'),
    join(moduleRoot, 'repositories/cancellation-repository.port.js'),
  );
}
moveAllJs(domainDir, join(moduleRoot, 'models'));
moveAllJs(join(moduleRoot, 'application'), join(moduleRoot, 'services'));
moveAllJs(join(moduleRoot, 'infrastructure'), join(moduleRoot, 'repositories'));

if (existsSync(join(moduleRoot, 'services/cancellation-dto.js'))) {
  moveFile(join(moduleRoot, 'services/cancellation-dto.js'), join(moduleRoot, 'views/cancellation-dto.js'));
}

const presentationDir = join(moduleRoot, 'presentation');
if (existsSync(join(presentationDir, 'cancellation.mapper.js'))) {
  moveFile(join(presentationDir, 'cancellation.mapper.js'), join(moduleRoot, 'views/cancellation.mapper.js'));
}
if (existsSync(join(presentationDir, 'cancellation.schemas.js'))) {
  moveFile(join(presentationDir, 'cancellation.schemas.js'), join(moduleRoot, 'views/cancellation.schemas.js'));
}
if (existsSync(join(presentationDir, 'cancellation.routes.js'))) {
  moveFile(join(presentationDir, 'cancellation.routes.js'), join(moduleRoot, 'controllers/cancellation.routes.js'));
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

// --- rewrites (entire repo, cancellations path tokens only) ---
const scanRoots = [
  join(repoRoot, 'src'),
  join(repoRoot, 'tests'),
  join(repoRoot, 'test'),
  join(repoRoot, 'docs/architecture/function-based-mvc-migration.md'),
];

/** @type {string[]} */
const files = [];
for (const root of scanRoots) {
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
  let content = readFileSync(file, 'utf8');
  let updated = rewriteCancellationsPaths(content);
  if (file.includes(`${join('modules', 'cancellations')}`)) {
    updated = rewriteInsideCancellationsModule(updated);
  }
  if (file.includes(join('cancellations', 'controllers', 'nest'))) {
    updated = patchNestAdapter(updated);
  }
  if (file.includes(join('cancellations', 'controllers', 'cancellation.routes.js'))) {
    updated = updated
      .replace("from './cancellation.mapper.js'", "from '../views/cancellation.mapper.js'")
      .replace("from './cancellation.schemas.js'", "from '../views/cancellation.schemas.js'");
  }
  if (updated !== content) {
    writeFileSync(file, updated, 'utf8');
  }
}

console.log('Phase 4.7 cancellations MVC restructure complete.');
