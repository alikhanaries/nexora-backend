import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const repoRoot = fileURLToPath(new URL('../../../', import.meta.url));
const routeSource = readFileSync(
  join(repoRoot, 'src/modules/compatibility/presentation/compat-v2.routes.js'),
  'utf8',
);

const REQUIRED_PUBLIC_ROUTES = [
  "typed.get('/api/v2/ce/orders'",
  "typed.post('/api/v2/ce/orders/acknowledge'",
  "typed.post('/api/v2/ce/cancellations'",
  "typed.get('/api/v2/ce/channels'",
];

describe('compat v2 route registration', () => {
  it('keeps public /api/v2/ce/* handlers registered in Fastify compatibility routes', () => {
    for (const snippet of REQUIRED_PUBLIC_ROUTES) {
      expect(routeSource).toContain(snippet);
    }
  });
});
