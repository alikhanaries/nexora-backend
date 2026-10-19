import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const repoRoot = fileURLToPath(new URL('../../../', import.meta.url));
const FORBIDDEN = /\bnexora\b|\bchannelengine\b|\bchannel-engine\b/i;

const CONFIG_LAYER_FILES = [
  'src/app/config/schema.js',
  'src/app/config/wasl-config.module.js',
  'src/app/database/database.tokens.js',
];

describe('Wasl naming guard (config layer)', () => {
  it('does not contain legacy platform identifiers in central config files', () => {
    const offenders = [];
    for (const rel of CONFIG_LAYER_FILES) {
      const content = readFileSync(join(repoRoot, rel), 'utf8');
      if (FORBIDDEN.test(content)) {
        offenders.push(rel);
      }
    }
    expect(offenders).toEqual([]);
  });
});
