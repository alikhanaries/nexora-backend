import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const repoRoot = fileURLToPath(new URL('../../../', import.meta.url));

describe('Wasl naming configuration layer', () => {
  it('lives under shared/config for infrastructure imports', () => {
    const content = readFileSync(
      join(repoRoot, 'src/infrastructure/queue/queue-names.js'),
      'utf8',
    );
    expect(content).toContain('shared/config/wasl-naming.config.js');
    expect(content).not.toContain('app/config/naming.config.js');
  });

  it('re-exports from app/config for schema convenience only', () => {
    const content = readFileSync(join(repoRoot, 'src/app/config/naming.config.js'), 'utf8');
    expect(content).toContain('shared/config/wasl-naming.config.js');
  });
});
