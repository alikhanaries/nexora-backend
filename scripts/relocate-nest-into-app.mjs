/**
 * Relocate top-level src/app composition into src/app and delete src/nest.
 *
 * Mapping:
 *   nest/app.module.js              -> app/app.module.js
 *   nest/main.js                    -> app/nest-main.js
 *   nest/bootstrap.mjs              -> app/nest-bootstrap.mjs
 *   nest/bootstrap/*                -> app/*
 *   nest/common/*                   -> app/common/*
 *   app/config/wasl-config.module.js    -> app/config/wasl-config.module.js
 *   nest/database/*                 -> app/database/*
 *   nest/di/*                       -> app/di/*
 *
 * Usage: node scripts/relocate-nest-into-app.mjs [--dry-run]
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

function ensureDir(path) {
  if (!existsSync(path) && !dryRun) mkdirSync(path, { recursive: true });
}

function movePath(from, to) {
  if (!existsSync(from)) {
    console.log(`skip missing ${relative(repoRoot, from)}`);
    return;
  }
  console.log(`${dryRun ? '[dry] ' : ''}mv ${relative(repoRoot, from)} → ${relative(repoRoot, to)}`);
  if (dryRun) return;
  ensureDir(dirname(to));
  if (existsSync(to)) {
    if (statSync(from).isDirectory()) {
      for (const name of readdirSync(from)) {
        movePath(join(from, name), join(to, name));
      }
      if (existsSync(from) && readdirSync(from).length === 0) {
        rmSync(from, { recursive: true, force: true });
      }
      return;
    }
    console.warn(`  skip exists ${relative(repoRoot, to)}`);
    return;
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
      if (name === 'node_modules' || name === '.git' || name === 'coverage') continue;
      walkFiles(full, out);
    } else {
      out.push(full);
    }
  }
  return out;
}

function rewriteFile(filePath, transform) {
  const ext = filePath.slice(filePath.lastIndexOf('.'));
  if (!TEXT_EXT.has(ext) && !filePath.endsWith('Dockerfile')) return false;
  const before = readFileSync(filePath, 'utf8');
  const after = transform(before, filePath);
  if (after === before) return false;
  if (!dryRun) writeFileSync(filePath, after);
  console.log(`${dryRun ? '[dry] ' : ''}rewrite ${relative(repoRoot, filePath)}`);
  return true;
}

function physicalMoves() {
  const nest = join(repoRoot, 'src/app');
  const app = join(repoRoot, 'src/app');

  movePath(join(nest, 'app.module.js'), join(app, 'app.module.js'));
  movePath(join(nest, 'main.js'), join(app, 'nest-main.js'));
  movePath(join(nest, 'bootstrap.mjs'), join(app, 'nest-bootstrap.mjs'));

  for (const name of readdirSync(join(nest, 'bootstrap'))) {
    movePath(join(nest, 'bootstrap', name), join(app, 'bootstrap', name));
  }
  movePath(join(nest, 'common'), join(app, 'common'));
  movePath(join(nest, 'config', 'config.module.js'), join(app, 'config', 'wasl-config.module.js'));
  movePath(join(nest, 'database'), join(app, 'database'));
  movePath(join(nest, 'di'), join(app, 'di'));
}

/** Fix imports inside files that now live under src/app. */
function fixMovedAppInternals(content, filePath) {
  const rel = relative(join(repoRoot, 'src/app'), filePath).replace(/\\/g, '/');
  let next = content;

  // Config Nest module filename
  next = next.replace(/config\/config\.module\.js/g, 'config/wasl-config.module.js');
  next = next.replace(/from ['"]\.\/config\/config\.module\.js['"]/g, `from './config/wasl-config.module.js'`);
  next = next.replace(/from ['"]\.\.\/config\/config\.module\.js['"]/g, `from '../config/wasl-config.module.js'`);

  if (rel === 'nest-main.js') {
    next = next.replace(
      /from ['"]\.\/health\/readiness\.provider\.js['"]/,
      `from '../modules/health/controllers/nest/readiness.provider.js'`,
    );
    next = next.replace(
      /from ['"]\.\.\/app\/config\//g,
      `from './config/`,
    );
  }

  if (rel === 'nest-bootstrap.mjs') {
    next = next.replace(/await import\(['"]\.\/main\.js['"]\)/, `await import('./nest-main.js')`);
  }

  if (rel === 'config/wasl-config.module.js') {
    next = next.replace(
      /from ['"]\.\.\/\.\.\/app\/config\/index\.js['"]/,
      `from './index.js'`,
    );
  }

  if (rel.startsWith('database/')) {
    next = next.replace(
      /from ['"]\.\.\/\.\.\/app\/observability\//g,
      `from '../observability/`,
    );
  }

  if (rel.startsWith('bootstrap/')) {
    // Previously ../../app/X from nest/bootstrap; now ../X
    next = next.replace(/from ['"]\.\.\/\.\.\/app\//g, `from '../`);
    next = next.replace(/import\(['"]\.\.\/\.\.\/app\//g, `import('../`);
    // JSDoc import('../../app/config → import('../config
    next = next.replace(/import\(['"]\.\.\/\.\.\/app\/config\//g, `import('../config/`);
  }

  if (rel.startsWith('common/')) {
    next = next.replace(/from ['"]\.\.\/\.\.\/app\//g, `from '../`);
  }

  if (rel === 'app.module.js') {
    next = next.replace(
      /from ['"]\.\/config\/config\.module\.js['"]/,
      `from './config/wasl-config.module.js'`,
    );
  }

  return next;
}

/**
 * Consumer / docs rewrite: map src/app paths to src/app destinations.
 * Must NOT touch modules/.../controllers/nest/ or test/nest/.
 */
function globalRewrite(content) {
  let next = content;

  // Explicit entry points
  next = next.replace(/src\/nest\/bootstrap\.mjs/g, 'src/app/nest-bootstrap.mjs');
  next = next.replace(/src\/nest\/main\.js/g, 'src/app/nest-main.js');
  next = next.replace(/src\/nest\/app\.module\.js/g, 'src/app/app.module.js');

  // Directory mappings (order matters: longer / more specific first)
  next = next.replace(/src\/nest\/config\/config\.module\.js/g, 'src/app/config/wasl-config.module.js');
  next = next.replace(/nest\/config\/config\.module\.js/g, 'app/config/wasl-config.module.js');

  next = next.replace(/src\/nest\/bootstrap\//g, 'src/app/');
  next = next.replace(/src\/nest\/common\//g, 'src/app/common/');
  next = next.replace(/src\/nest\/database\//g, 'src/app/database/');
  next = next.replace(/src\/nest\/di\//g, 'src/app/di/');
  next = next.replace(/src\/nest\/config\//g, 'src/app/config/');

  // Relative imports that pointed at top-level nest (not controllers/nest)
  // Patterns like ../../nest/di/ or ../../../../nest/common/
  next = next.replace(
    /([`'"])(\.\.\/)+nest\/(di|common|bootstrap|database)\//g,
    (match, quote, _dots, folder) => {
      // Keep the same number of ../ and swap nest → app
      const prefix = match.slice(0, match.indexOf('nest/'));
      return `${prefix}app/${folder}/`;
    },
  );
  next = next.replace(
    /([`'"])(\.\.\/)+nest\/config\/config\.module\.js/g,
    (match, quote) => {
      const prefix = match.slice(0, match.indexOf('nest/'));
      return `${prefix}app/config/wasl-config.module.js`;
    },
  );
  next = next.replace(
    /([`'"])(\.\.\/)+nest\/app\.module\.js/g,
    (match) => {
      const prefix = match.slice(0, match.indexOf('nest/'));
      return `${prefix}app/app.module.js`;
    },
  );

  // Bare path forms in docs / package scripts already handled for src/app/
  // Remaining "src/app" mentions
  next = next.replace(/src\/nest(?=\/|[`'"]|\s|$)/g, 'src/app');

  // Avoid turning controllers/nest into controllers/app — the regex above used nest/(di|common|...)
  // and src/app only. Good.

  // Fix accidental src/app/health if any leftover from broken main path docs
  next = next.replace(
    /src\/app\/health\/readiness\.provider\.js/g,
    'src/modules/health/controllers/nest/readiness.provider.js',
  );

  return next;
}

function removeEmptyNest() {
  const nest = join(repoRoot, 'src/app');
  if (!existsSync(nest)) {
    console.log('src/app already gone');
    return;
  }
  const leftover = walkFiles(nest);
  if (leftover.length > 0) {
    console.warn('leftover under src/nest:');
    for (const f of leftover) console.warn(' ', relative(repoRoot, f));
    return;
  }
  // remove empty dirs
  console.log(`${dryRun ? '[dry] ' : ''}rm src/app`);
  if (!dryRun) rmSync(nest, { recursive: true, force: true });
}

function main() {
  console.log(dryRun ? 'DRY RUN' : 'Relocating src/app → src/app…');

  if (!existsSync(join(repoRoot, 'src/app'))) {
    console.error('src/app missing — nothing to do');
    process.exit(1);
  }

  physicalMoves();

  // Fix internals of newly placed app files
  for (const file of walkFiles(join(repoRoot, 'src/app'))) {
    if (!file.endsWith('.js') && !file.endsWith('.mjs')) continue;
    const rel = relative(join(repoRoot, 'src/app'), file).replace(/\\/g, '/');
    // Only touch files we moved (or that reference old nest config module name)
    const movedHints = [
      'app.module.js',
      'nest-main.js',
      'nest-bootstrap.mjs',
      'wasl-config.module.js',
      'create-nest-',
      'configure-express',
      'configure-api-docs',
      'wire-core-services',
      'wire-compatibility',
      'wire-marketplace-webhook',
      'create-nest-infrastructure',
      'commerce-actor',
      'nest-logger',
      'public-route',
      'public.decorator',
      'global-exception',
      'compatibility-exception',
      'auth.guard',
      'database.module',
      'database.service',
      'database.tokens',
      'core-services',
    ];
    if (!movedHints.some((h) => rel.includes(h) || file.includes(h))) {
      // still rewrite create-nest-http-server and any file mentioning nest config module
      const raw = readFileSync(file, 'utf8');
      if (!raw.includes('nest/') && !raw.includes('config.module.js')) continue;
    }
    rewriteFile(file, (c, p) => fixMovedAppInternals(globalRewrite(c), p));
  }

  // Global rewrite across repo (skip node_modules)
  const roots = [
    'src',
    'test',
    'tests',
    'scripts',
    'docs',
    'package.json',
    'eslint.config.js',
    'vitest.config.js',
    'jest.config.js',
  ];
  for (const root of roots) {
    const full = join(repoRoot, root);
    if (!existsSync(full)) continue;
    if (statSync(full).isFile()) {
      rewriteFile(full, (c) => globalRewrite(c));
      continue;
    }
    for (const file of walkFiles(full)) {
      const rel = relative(repoRoot, file).replace(/\\/g, '/');
      // Skip one-shot migration scripts that document old paths historically? Still update active ones.
      rewriteFile(file, (c) => globalRewrite(c));
    }
  }

  removeEmptyNest();

  // Ensure nest-bootstrap points at nest-main
  const boot = join(repoRoot, 'src/app/nest-bootstrap.mjs');
  if (existsSync(boot)) {
    rewriteFile(boot, (c) =>
      c.replace(/await import\(['"]\.\/main\.js['"]\)/, `await import('./nest-main.js')`),
    );
  }

  console.log('done');
}

main();
