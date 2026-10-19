/**
 * Undo overly broad MVC path rewrites outside the orders module.
 */
import { readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = join(fileURLToPath(new URL('.', import.meta.url)), '..');

/** @param {string} dir @param {(path: string) => void} visit */
function walkDir(dir, visit) {
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) {
      walkDir(full, visit);
    } else {
      visit(full);
    }
  }
}

function isOrdersModuleFile(path) {
  const rel = relative(join(repoRoot, 'src/modules/orders'), path);
  return !rel.startsWith('..') && !rel.includes('..');
}

function revertNonOrdersContent(content) {
  return content
    .replaceAll('../services/', '../application/')
    .replaceAll('./services/', './application/')
    .replaceAll('../models/', '../domain/')
    .replaceAll('./models/', './domain/')
    .replaceAll('../repositories/', '../infrastructure/')
    .replaceAll('./repositories/', './infrastructure/')
    .replaceAll('../controllers/', '../presentation/')
    .replaceAll('./controllers/', './presentation/')
    .replaceAll('../views/', '../presentation/')
    .replaceAll('./views/', './presentation/');
}

/** @param {string} root */
function fixTree(root) {
  if (!statSync(root).isDirectory()) {
    return;
  }
  walkDir(root, (file) => {
    if (!file.endsWith('.js')) {
      return;
    }
    if (isOrdersModuleFile(file)) {
      return;
    }
    const original = readFileSync(file, 'utf8');
    const updated = revertNonOrdersContent(original);
    if (updated !== original) {
      writeFileSync(file, updated, 'utf8');
    }
  });
}

fixTree(join(repoRoot, 'src/modules'));
fixTree(join(repoRoot, 'tests'));
fixTree(join(repoRoot, 'src/nest'));
fixTree(join(repoRoot, 'src/workers'));
fixTree(join(repoRoot, 'src/app'));
fixTree(join(repoRoot, 'src/integrations'));

console.log('Reverted non-orders layer path rewrites (application, domain, infrastructure).');
