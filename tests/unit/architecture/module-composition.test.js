import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const repoRoot = fileURLToPath(new URL('../../../', import.meta.url));
const modulesDir = join(repoRoot, 'src/modules');

/** @returns {string[]} */
function moduleIndexFiles() {
  return readdirSync(modulesDir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => join(modulesDir, entry.name, 'index.js'))
    .filter((path) => {
      try {
        readFileSync(path, 'utf8');
        return true;
      } catch {
        return false;
      }
    });
}

describe('module composition roots', () => {
  it('expose a create*Module factory from each module index', () => {
    const missing = [];
    for (const indexPath of moduleIndexFiles()) {
      const content = readFileSync(indexPath, 'utf8');
      const hasFactory =
        /export (?:async )?function create\w+Module\s*\(/.test(content) ||
        /export \{ create\w+Module/.test(content);
      if (!hasFactory) {
        missing.push(indexPath.replace(/\\/g, '/').split('/src/modules/')[1]);
      }
    }
    expect(missing).toEqual([]);
  });
});
