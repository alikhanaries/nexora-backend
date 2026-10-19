import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const repoRoot = fileURLToPath(new URL('../../../', import.meta.url));

describe('Wasl naming guard script', () => {
  it('passes on active source and tooling', () => {
    execFileSync(process.execPath, ['scripts/verify-wasl-naming.mjs'], {
      cwd: repoRoot,
      stdio: 'pipe',
    });
    expect(true).toBe(true);
  });
});
