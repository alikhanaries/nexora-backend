import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const repoRoot = fileURLToPath(new URL('../../../', import.meta.url));
const compatibilityRoot = join(repoRoot, 'src/modules/compatibility');

const FORBIDDEN = /\b(?:ChannelEngine|channelEngine|channel-engine|Wasl|nexora|StockConnectCe|stockConnectCe)\b/;

/** @param {string} dir @param {string[]} files */
function collectJsFiles(dir, files = []) {
  for (const entry of readdirSync(dir)) {
    const fullPath = join(dir, entry);
    if (statSync(fullPath).isDirectory()) {
      collectJsFiles(fullPath, files);
      continue;
    }
    if (entry.endsWith('.js')) {
      files.push(fullPath);
    }
  }
  return files;
}

describe('compatibility layer naming guard', () => {
  it('does not use legacy provider branding in compatibility implementation files', () => {
    const offenders = [];
    for (const file of collectJsFiles(compatibilityRoot)) {
      const rel = file.replace(/\\/g, '/').slice(repoRoot.replace(/\\/g, '/').length + 1);
      const content = readFileSync(file, 'utf8');
      if (FORBIDDEN.test(content)) {
        offenders.push(rel);
      }
    }
    expect(offenders).toEqual([]);
  });
});
