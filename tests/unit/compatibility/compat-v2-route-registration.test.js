import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const repoRoot = fileURLToPath(new URL('../../../', import.meta.url));

const CONTROLLER_FILES = [
  'src/modules/compatibility/controllers/nest/compat-v2.controller.js',
  'src/modules/compatibility/controllers/nest/compat-v2-orders.controller.js',
];

const REQUIRED_PUBLIC_ROUTES = [
  "/api/v2/ce/orders'",
  "/api/v2/ce/orders/acknowledge'",
  "/api/v2/ce/cancellations'",
  "/api/v2/ce/channels'",
];

describe('compat v2 route registration', () => {
  it('keeps public /api/v2/ce/* handlers on Nest compatibility controllers', () => {
    const source = CONTROLLER_FILES.map((rel) =>
      readFileSync(join(repoRoot, rel), 'utf8'),
    ).join('\n');
    for (const snippet of REQUIRED_PUBLIC_ROUTES) {
      expect(source).toContain(snippet);
    }
  });
});
