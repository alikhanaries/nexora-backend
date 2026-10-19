/**
 * Finish Nest to MVC cleanup:
 * 1. Move remaining feature folders out of src/app into modules controllers/nest
 * 2. Rename nest/domain to nest/di (drop domain naming)
 * 3. Rename CORE_SERVICES to CORE_SERVICES token files
 * 4. Fix StockConnect + app.module imports
 * 5. Rewrite import paths across the repo
 *
 * Usage: node scripts/collapse-nest-features.mjs [--dry-run]
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
import { dirname, join, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = fileURLToPath(new URL('..', import.meta.url));
const dryRun = process.argv.includes('--dry-run');

/** @type {{ from: string, to: string }[]} */
const FEATURE_MOVES = [
  { from: 'src/app/auth', to: 'src/modules/identity/controllers/nest' },
  { from: 'src/app/legacy-orders', to: 'src/modules/compatibility/controllers/nest' },
  { from: 'src/app/legacy-compatibility', to: 'src/modules/compatibility/controllers/nest' },
  { from: 'src/app/stock-connect', to: 'src/modules/stock-connect/controllers/nest' },
  { from: 'src/app/stock-connect-integration', to: 'src/modules/stock-connect/controllers/nest' },
  { from: 'src/app/health', to: 'src/modules/health/controllers/nest' },
];

const TEXT_EXT = new Set([
  '.js',
  '.mjs',
  '.cjs',
  '.ts',
  '.md',
  '.json',
  '.yml',
  '.yaml',
]);

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
      } catch {
        cpSync(src, dest, { recursive: true });
        rmSync(src, { recursive: true, force: true });
      }
    }
    if (existsSync(from) && readdirSync(from).length === 0) {
      rmSync(from, { recursive: true, force: true });
    }
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

function rewriteFile(filePath, replacer) {
  const ext = filePath.slice(filePath.lastIndexOf('.'));
  if (!TEXT_EXT.has(ext) && !filePath.endsWith('Dockerfile')) return false;
  const before = readFileSync(filePath, 'utf8');
  const after = replacer(before, filePath);
  if (after === before) return false;
  if (!dryRun) writeFileSync(filePath, after);
  console.log(`${dryRun ? '[dry] ' : ''}rewrite ${relative(repoRoot, filePath)}`);
  return true;
}

/** Depth from file to src/ (number of ../ needed). */
function depthToSrc(filePath) {
  const rel = relative(join(repoRoot, 'src'), dirname(filePath));
  if (rel === '' || rel === '.') return 0;
  return rel.split(/[/\\]/).filter(Boolean).length;
}

function prefixToSrc(filePath) {
  const d = depthToSrc(filePath);
  return d === 0 ? './' : '../'.repeat(d);
}

/**
 * Rewrite relative imports inside a moved Nest controller file.
 * Files live at modules/<x>/controllers/nest/*.js
 */
function rewriteMovedControllerFile(content, filePath) {
  const toSrc = prefixToSrc(filePath);
  const nestRoot = `${toSrc}nest/`;
  let next = content;

  // Shared / modules / app / infrastructure from old nest/<feature>/ (../../x)
  next = next.replace(
    /from ['"]\.\.\/\.\.\/(shared|modules|app|infrastructure|integrations|workers)\//g,
    `from '${toSrc}$1/`,
  );

  // Old sibling nest paths
  next = next.replace(/from ['"]\.\.\/domain\//g, `from '${nestRoot}di/`);
  next = next.replace(/from ['"]\.\.\/common\//g, `from '${nestRoot}common/`);
  next = next.replace(/from ['"]\.\.\/config\//g, `from '${nestRoot}config/`);
  next = next.replace(/from ['"]\.\.\/health\//g, `from '${toSrc}modules/health/controllers/nest/`);
  next = next.replace(
    /from ['"]\.\.\/legacy-orders\//g,
    `from '${toSrc}modules/compatibility/controllers/nest/`,
  );
  next = next.replace(
    /from ['"]\.\.\/legacy-compatibility\//g,
    `from '${toSrc}modules/compatibility/controllers/nest/`,
  );
  next = next.replace(
    /from ['"]\.\.\/stock-connect\//g,
    `from '${toSrc}modules/stock-connect/controllers/nest/`,
  );
  next = next.replace(
    /from ['"]\.\.\/stock-connect-integration\//g,
    `from '${toSrc}modules/stock-connect/controllers/nest/`,
  );
  next = next.replace(
    /from ['"]\.\.\/auth\//g,
    `from '${toSrc}modules/identity/controllers/nest/`,
  );

  // Broken nest-relative feature module imports (stock-connect-integration)
  next = next.replace(
    /from ['"]\.\.\/commerce-integrations\/commerce-integrations\.module\.js['"]/g,
    `from '${toSrc}modules/commerce-integrations/controllers/nest/commerce-integrations.module.js'`,
  );
  next = next.replace(
    /from ['"]\.\.\/inventory\/inventory\.module\.js['"]/g,
    `from '${toSrc}modules/inventory/controllers/nest/inventory.module.js'`,
  );
  next = next.replace(
    /from ['"]\.\.\/offers\/offers\.module\.js['"]/g,
    `from '${toSrc}modules/offers/controllers/nest/offers.module.js'`,
  );
  next = next.replace(
    /from ['"]\.\.\/products\/products\.module\.js['"]/g,
    `from '${toSrc}modules/products/controllers/nest/products.module.js'`,
  );

  // Same-module shortcuts for compatibility controllers
  if (filePath.includes(`${sep}compatibility${sep}controllers${sep}nest${sep}`)) {
    next = next.replace(
      /from ['"](?:\.\.\/)+modules\/compatibility\/services\//g,
      `from '../../services/`,
    );
    next = next.replace(
      /from ['"](?:\.\.\/)+modules\/compatibility\/views\//g,
      `from '../../views/`,
    );
  }

  // Token rename
  next = next.replace(/core-domain\.tokens\.js/g, 'core-services.tokens.js');
  next = next.replace(/CORE_SERVICES/g, 'CORE_SERVICES');

  return next;
}

function globalRewrite(content) {
  let next = content;

  // Feature locations
  next = next.replace(/src\/nest\/auth\//g, 'src/modules/identity/controllers/nest/');
  next = next.replace(
    /(['"])\.\.\/auth\/(auth\.(?:module|controller|service)\.js)\1/g,
    `$1../modules/identity/controllers/nest/$2$1`,
  );
  next = next.replace(
    /from ['"]\.\/auth\/auth\.module\.js['"]/g,
    `from '../modules/identity/controllers/nest/auth.module.js'`,
  );

  next = next.replace(/src\/nest\/legacy-orders\//g, 'src/modules/compatibility/controllers/nest/');
  next = next.replace(
    /src\/nest\/legacy-compatibility\//g,
    'src/modules/compatibility/controllers/nest/',
  );
  next = next.replace(
    /from ['"]\.\/legacy-orders\/legacy-orders\.module\.js['"]/g,
    `from '../modules/compatibility/controllers/nest/legacy-orders.module.js'`,
  );
  next = next.replace(
    /from ['"]\.\/legacy-compatibility\/legacy-compatibility\.module\.js['"]/g,
    `from '../modules/compatibility/controllers/nest/legacy-compatibility.module.js'`,
  );

  next = next.replace(/src\/nest\/stock-connect\//g, 'src/modules/stock-connect/controllers/nest/');
  next = next.replace(
    /src\/nest\/stock-connect-integration\//g,
    'src/modules/stock-connect/controllers/nest/',
  );
  next = next.replace(
    /from ['"]\.\/stock-connect-integration\/stock-connect-integration\.module\.js['"]/g,
    `from '../modules/stock-connect/controllers/nest/stock-connect-integration.module.js'`,
  );
  next = next.replace(
    /from ['"]\.\/stock-connect\/stock-connect\.module\.js['"]/g,
    `from '../modules/stock-connect/controllers/nest/stock-connect.module.js'`,
  );

  next = next.replace(/src\/nest\/health\//g, 'src/modules/health/controllers/nest/');
  next = next.replace(
    /from ['"]\.\/health\/health\.module\.js['"]/g,
    `from '../modules/health/controllers/nest/health.module.js'`,
  );
  next = next.replace(
    /from ['"]\.\.\/health\/readiness\.provider\.js['"]/g,
    `from '../../modules/health/controllers/nest/readiness.provider.js'`,
  );
  next = next.replace(
    /from ['"]\.\.\/health\/health\.module\.js['"]/g,
    `from '../../modules/health/controllers/nest/health.module.js'`,
  );

  // domain → di + token rename
  next = next.replace(/nest\/domain\//g, 'nest/di/');
  next = next.replace(/core-domain\.module\.js/g, 'core-services.module.js');
  next = next.replace(/core-domain\.tokens\.js/g, 'core-services.tokens.js');
  next = next.replace(/CoreServicesModule/g, 'CoreServicesModule');
  next = next.replace(/CORE_SERVICES/g, 'CORE_SERVICES');
  next = next.replace(/coreServices/g, 'coreServices');
  next = next.replace(/wire-core-domain\.js/g, 'wire-core-services.js');
  next = next.replace(/wireCoreServices/g, 'wireCoreServices');

  // Relative nest/domain from controllers/nest (4 levels up to src)
  next = next.replace(
    /from ['"](?:\.\.\/)+nest\/di\/core-services\.tokens\.js['"]/g,
    (m) => m, // already rewritten
  );

  return next;
}

function renameDomainFolder() {
  const from = join(repoRoot, 'src/app/domain');
  const to = join(repoRoot, 'src/app/di');
  if (!existsSync(from)) {
    console.log('skip domain rename (missing)');
    return;
  }
  console.log(`${dryRun ? '[dry] ' : ''}mv src/app/domain → src/app/di`);
  if (dryRun) return;
  ensureDir(dirname(to));
  if (existsSync(to)) {
    for (const name of readdirSync(from)) {
      const dest = join(to, name);
      if (!existsSync(dest)) {
        renameSync(join(from, name), dest);
      }
    }
    rmSync(from, { recursive: true, force: true });
  } else {
    renameSync(from, to);
  }

  const tokensOld = join(to, 'core-services.tokens.js');
  const tokensNew = join(to, 'core-services.tokens.js');
  const modOld = join(to, 'core-services.module.js');
  const modNew = join(to, 'core-services.module.js');
  if (existsSync(tokensOld) && !existsSync(tokensNew)) renameSync(tokensOld, tokensNew);
  if (existsSync(modOld) && !existsSync(modNew)) renameSync(modOld, modNew);
}

function renameWireCoreDomain() {
  const from = join(repoRoot, 'src/app/wire-core-services.js');
  const to = join(repoRoot, 'src/app/wire-core-services.js');
  if (existsSync(from) && !existsSync(to)) {
    console.log(`${dryRun ? '[dry] ' : ''}mv wire-core-services.js → wire-core-services.js`);
    if (!dryRun) renameSync(from, to);
  }
}

function main() {
  console.log(dryRun ? 'DRY RUN' : 'Applying collapse-nest-features…');

  for (const { from, to } of FEATURE_MOVES) {
    movePath(join(repoRoot, from), join(repoRoot, to));
  }

  renameDomainFolder();
  renameWireCoreDomain();

  // Rewrite moved controller files first (path-aware)
  for (const { to } of FEATURE_MOVES) {
    const dir = join(repoRoot, to);
    for (const file of walkFiles(dir)) {
      if (!file.endsWith('.js')) continue;
      rewriteFile(file, (c, p) => rewriteMovedControllerFile(c, p));
    }
  }

  // Global rewrite across repo (except node_modules)
  const roots = ['src', 'test', 'tests', 'scripts', 'docs', 'package.json', 'eslint.config.js', 'vitest.config.js'];
  for (const root of roots) {
    const full = join(repoRoot, root);
    if (!existsSync(full)) continue;
    if (statSync(full).isFile()) {
      rewriteFile(full, (c) => globalRewrite(c));
      continue;
    }
    for (const file of walkFiles(full)) {
      rewriteFile(file, (c) => globalRewrite(c));
    }
  }

  // Fix database.module readiness import if still pointing at nest/health
  const dbMod = join(repoRoot, 'src/app/database/database.module.js');
  if (existsSync(dbMod)) {
    rewriteFile(dbMod, (c) =>
      c.replace(
        /from ['"]\.\.\/(?:health|modules\/health\/controllers\/nest)\/readiness\.provider\.js['"]/,
        `from '../../modules/health/controllers/nest/readiness.provider.js'`,
      ),
    );
  }

  // Fix app.module CoreServices import path after domain→di rename
  const appMod = join(repoRoot, 'src/app/app.module.js');
  if (existsSync(appMod)) {
    rewriteFile(appMod, (c) =>
      globalRewrite(c)
        .replace(
          /from ['"]\.\/di\/core-services\.module\.js['"]/,
          `from './di/core-services.module.js'`,
        )
        .replace(
          /from ['"]\.\/domain\/core-services\.module\.js['"]/,
          `from './di/core-services.module.js'`,
        ),
    );
  }

  console.log('done');
}

main();
