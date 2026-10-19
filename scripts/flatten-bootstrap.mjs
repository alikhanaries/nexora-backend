/**
 * Remove bootstrap/ folders by flattening into parent dirs:
 *   src/app/*     -> src/app/ (HTTP helpers -> src/app/http/)
 *   src/workers/* -> src/workers/
 *   authorization/create-authorization-module.js -> authorization/
 *
 * Usage: node scripts/flatten-bootstrap.mjs
 */
import {
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  renameSync,
  rmSync,
  statSync,
  writeFileSync,
  cpSync,
} from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = fileURLToPath(new URL('..', import.meta.url));
const TEXT_EXT = new Set(['.js', '.mjs', '.cjs', '.ts', '.md', '.json']);

function ensureDir(p) {
  if (!existsSync(p)) mkdirSync(p, { recursive: true });
}

function movePath(from, to) {
  if (!existsSync(from)) {
    console.log('skip missing', relative(repoRoot, from));
    return;
  }
  console.log(`mv ${relative(repoRoot, from)} → ${relative(repoRoot, to)}`);
  ensureDir(dirname(to));
  if (existsSync(to)) {
    console.warn('  exists, overwrite via copy', relative(repoRoot, to));
    rmSync(to, { recursive: true, force: true });
  }
  try {
    renameSync(from, to);
  } catch {
    cpSync(from, to, { recursive: true });
    rmSync(from, { recursive: true, force: true });
  }
}

function walkFiles(dir, out = []) {
  if (!existsSync(dir)) return out;
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) {
      if (name === 'node_modules' || name === '.git') continue;
      walkFiles(full, out);
    } else out.push(full);
  }
  return out;
}

function rewriteFile(filePath, transform) {
  const ext = filePath.slice(filePath.lastIndexOf('.'));
  if (!TEXT_EXT.has(ext)) return;
  const before = readFileSync(filePath, 'utf8');
  const after = transform(before);
  if (after !== before) {
    writeFileSync(filePath, after);
    console.log('rewrite', relative(repoRoot, filePath));
  }
}

/** Global path string rewrites for consumers. */
function globalRewrite(content) {
  let next = content;
  // app bootstrap → app root / http
  next = next.replace(/src\/app\/bootstrap\/configure-api-docs-express\.js/g, 'src/app/http/configure-api-docs-express.js');
  next = next.replace(/src\/app\/bootstrap\/configure-express\.js/g, 'src/app/http/configure-express.js');
  next = next.replace(/src\/app\/bootstrap\/create-nest-application\.js/g, 'src/app/http/create-nest-application.js');
  next = next.replace(/src\/app\/bootstrap\//g, 'src/app/');

  next = next.replace(/app\/bootstrap\/configure-api-docs-express\.js/g, 'app/http/configure-api-docs-express.js');
  next = next.replace(/app\/bootstrap\/configure-express\.js/g, 'app/http/configure-express.js');
  next = next.replace(/app\/bootstrap\/create-nest-application\.js/g, 'app/http/create-nest-application.js');
  next = next.replace(/app\/bootstrap\//g, 'app/');

  next = next.replace(/workers\/bootstrap\//g, 'workers/');
  next = next.replace(/src\/workers\/bootstrap\//g, 'src/workers/');

  next = next.replace(
    /authorization\/composition\/create-authorization-module\.js/g,
    'authorization/create-authorization-module.js',
  );

  // Relative imports from tests/scripts already handled by src/app/bootstrap → src/app/
  next = next.replace(/from ['"]\.\/bootstrap\//g, `from './`);
  next = next.replace(/from ['"]\.\.\/bootstrap\//g, `from '../`);
  next = next.replace(/from ['"]\.\.\/\.\.\/app\/bootstrap\//g, `from '../../app/`);
  next = next.replace(/from ['"]\.\.\/app\/bootstrap\//g, `from '../app/`);

  return next;
}

function fixAppRootImports(content) {
  let next = content;
  // Was under app/bootstrap: ../../X → ../X for modules/shared/infrastructure/workers
  next = next.replace(/from ['"]\.\.\/\.\.\/(modules|shared|infrastructure|workers)\//g, `from '../$1/`);
  next = next.replace(/import\(['"]\.\.\/\.\.\/(modules|shared|infrastructure|workers)\//g, `import('../$1/`);
  // Was ../http → ./http ; ../observability → ./observability ; ../config stays ../config from bootstrap... 
  // From bootstrap: ../http was app/http. From app root: ./http
  next = next.replace(/from ['"]\.\.\/http\//g, `from './http/`);
  next = next.replace(/from ['"]\.\.\/observability\//g, `from './observability/`);
  next = next.replace(/from ['"]\.\.\/config\//g, `from './config/`);
  // migrate-cli had ../config (correct for bootstrap→app/config). After move to app root still ./config - above handles.
  // migrate had ../../shared - handled by first replace to ../shared
  return next;
}

function fixHttpMovedImports(content) {
  let next = content;
  // configure-express / create-nest-application moved bootstrap → http (same depth under app)
  // create-nest-application: ./configure-express stays; ../app.module stays
  // configure-express: ../../shared stays (same)
  // Only fix if something pointed at bootstrap siblings incorrectly
  next = next.replace(
    /from ['"]\.\/configure-express\.js['"]/g,
    `from './configure-express.js'`,
  );
  next = next.replace(
    /from ['"]\.\/configure-api-docs-express\.js['"]/g,
    `from './configure-api-docs-express.js'`,
  );
  return next;
}

function fixWorkersFlatImports(content) {
  let next = content;
  // From workers/bootstrap: ../../modules → from workers: ../modules
  next = next.replace(/from ['"]\.\.\/\.\.\/(modules|shared|infrastructure|app)\//g, `from '../$1/`);
  next = next.replace(/import\(['"]\.\.\/\.\.\/(modules|shared|infrastructure|app)\//g, `import('../$1/`);
  // Sibling worker files: ./bootstrap/foo was external; internal ./foo stays
  // ../handlers was workers/handlers from bootstrap - from workers root: ./handlers
  next = next.replace(/from ['"]\.\.\/handlers\//g, `from './handlers/`);
  next = next.replace(/from ['"]\.\.\/observability\//g, `from './observability/`);
  next = next.replace(/from ['"]\.\.\/create-integration-event-consumers\.js['"]/g, `from './create-integration-event-consumers.js'`);
  return next;
}

function fixAuthCompositionImports(content) {
  let next = content;
  // Was composition/: ../views → ./views after move to module root
  next = next.replace(/from ['"]\.\.\/(views|services|repositories|public|models)\//g, `from './$1/`);
  next = next.replace(/from ['"]\.\.\/\.\.\/\.\.\/(shared|infrastructure)\//g, `from '../../../$1/`);
  // If composition used ../../shared (to src): from authorization/composition ../../.. = modules? 
  // composition → authorization → modules → src: ../../../shared
  // After move to authorization/: ../../shared
  next = next.replace(/from ['"]\.\.\/\.\.\/\.\.\/shared\//g, `from '../../shared/`);
  next = next.replace(/from ['"]\.\.\/\.\.\/\.\.\/infrastructure\//g, `from '../../infrastructure/`);
  return next;
}

function main() {
  const appBoot = join(repoRoot, 'src/app/bootstrap');
  const httpDir = join(repoRoot, 'src/app/http');
  const appDir = join(repoRoot, 'src/app');

  // App bootstrap → destinations
  const appMoves = [
    ['configure-express.js', join(httpDir, 'configure-express.js')],
    ['configure-api-docs-express.js', join(httpDir, 'configure-api-docs-express.js')],
    ['create-nest-application.js', join(httpDir, 'create-nest-application.js')],
    ['create-application.js', join(appDir, 'create-application.js')],
    ['create-infrastructure.js', join(appDir, 'create-infrastructure.js')],
    ['create-nest-infrastructure.js', join(appDir, 'create-nest-infrastructure.js')],
    ['shutdown.js', join(appDir, 'shutdown.js')],
    ['migrate-cli.js', join(appDir, 'migrate-cli.js')],
    ['external-id-backfill-cli.js', join(appDir, 'external-id-backfill-cli.js')],
    ['wire-marketplace-order-ingestion.js', join(appDir, 'wire-marketplace-order-ingestion.js')],
  ];

  for (const [name, dest] of appMoves) {
    movePath(join(appBoot, name), dest);
  }

  // Workers bootstrap → workers/
  const workersBoot = join(repoRoot, 'src/workers/bootstrap');
  if (existsSync(workersBoot)) {
    for (const name of readdirSync(workersBoot)) {
      movePath(join(workersBoot, name), join(repoRoot, 'src/workers', name));
    }
  }

  // authorization composition → module root
  const authComp = join(
    repoRoot,
    'src/modules/authorization/create-authorization-module.js',
  );
  movePath(authComp, join(repoRoot, 'src/modules/authorization/create-authorization-module.js'));

  // Fix internals of moved app root files
  for (const name of [
    'create-application.js',
    'create-infrastructure.js',
    'create-nest-infrastructure.js',
    'shutdown.js',
    'migrate-cli.js',
    'external-id-backfill-cli.js',
    'wire-marketplace-order-ingestion.js',
    'main.js',
  ]) {
    const f = join(appDir, name);
    if (existsSync(f)) rewriteFile(f, (c) => fixAppRootImports(globalRewrite(c)));
  }

  for (const name of [
    'configure-express.js',
    'configure-api-docs-express.js',
    'create-nest-application.js',
    'create-nest-http-server.js',
  ]) {
    const f = join(httpDir, name);
    if (existsSync(f)) rewriteFile(f, (c) => fixHttpMovedImports(globalRewrite(c)));
  }

  // create-nest-http-server: was ../bootstrap/create-nest-application → ./create-nest-application
  const nestHttp = join(httpDir, 'create-nest-http-server.js');
  if (existsSync(nestHttp)) {
    rewriteFile(nestHttp, (c) =>
      c.replace(
        /from ['"]\.\.\/bootstrap\/create-nest-application\.js['"]/,
        `from './create-nest-application.js'`,
      ).replace(
        /from ['"]\.\/create-nest-application\.js['"]/,
        `from './create-nest-application.js'`,
      ),
    );
  }

  // create-application: createNestHttpServer from ./http/
  const createApp = join(appDir, 'create-application.js');
  if (existsSync(createApp)) {
    rewriteFile(createApp, (c) =>
      c
        .replace(/from ['"]\.\.\/http\//g, `from './http/`)
        .replace(/from ['"]\.\/http\/create-nest-http-server\.js['"]/, `from './http/create-nest-http-server.js'`),
    );
  }

  // wire-marketplace-order-ingestion re-export path
  const wireMoi = join(appDir, 'wire-marketplace-order-ingestion.js');
  if (existsSync(wireMoi)) {
    rewriteFile(wireMoi, () =>
      `export { wireMarketplaceOrderIngestion } from '../workers/wire-marketplace-order-ingestion.js';\n`,
    );
  }

  // Only rewrite files moved to workers/ root (not handlers/observability nested dirs).
  const workersDir = join(repoRoot, 'src/workers');
  if (existsSync(workersDir)) {
    for (const name of readdirSync(workersDir)) {
      const file = join(workersDir, name);
      if (!statSync(file).isFile() || !name.endsWith('.js')) continue;
      rewriteFile(file, (c) => fixWorkersFlatImports(globalRewrite(c)));
    }
  }

  // Authorization module
  const authMod = join(repoRoot, 'src/modules/authorization/create-authorization-module.js');
  if (existsSync(authMod)) {
    rewriteFile(authMod, (c) => fixAuthCompositionImports(c));
  }
  const authIndex = join(repoRoot, 'src/modules/authorization/index.js');
  if (existsSync(authIndex)) {
    rewriteFile(authIndex, (c) =>
      c.replace(
        `./composition/create-authorization-module.js`,
        `./create-authorization-module.js`,
      ),
    );
  }

  // Global rewrite across repo
  for (const root of ['src', 'test', 'tests', 'scripts', 'docs', 'package.json']) {
    const full = join(repoRoot, root);
    if (!existsSync(full)) continue;
    if (statSync(full).isFile()) {
      rewriteFile(full, globalRewrite);
      continue;
    }
    for (const file of walkFiles(full)) {
      rewriteFile(file, globalRewrite);
    }
  }

  // Remove empty bootstrap / composition dirs
  for (const dir of [
    join(repoRoot, 'src/app/bootstrap'),
    join(repoRoot, 'src/workers/bootstrap'),
    join(repoRoot, 'src/modules/authorization/composition'),
  ]) {
    if (existsSync(dir)) {
      const left = walkFiles(dir);
      if (left.length === 0) {
        console.log('rm', relative(repoRoot, dir));
        rmSync(dir, { recursive: true, force: true });
      } else {
        console.warn('leftover', left.map((f) => relative(repoRoot, f)));
      }
    }
  }

  console.log('done');
}

main();
