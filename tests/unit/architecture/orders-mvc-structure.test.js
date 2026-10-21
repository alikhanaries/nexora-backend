import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const repoRoot = fileURLToPath(new URL('../../../', import.meta.url));
const ordersRoot = join(repoRoot, 'src/modules/orders');

const REQUIRED_DIRS = ['models', 'views', 'controllers', 'services', 'repositories', 'public'];

const LEGACY_DIRS = ['application', 'domain', 'infrastructure', 'presentation'];

describe('orders module physical MVC layout', () => {
  it('has required MVC directories with implementations', () => {
    for (const dir of REQUIRED_DIRS) {
      const path = join(ordersRoot, dir);
      expect(existsSync(path), `missing ${dir}/`).toBe(true);
      const entries = readdirSync(path);
      expect(entries.length, `${dir}/ is empty`).toBeGreaterThan(0);
    }
  });

  it('does not keep legacy layer folders with active code', () => {
    for (const dir of LEGACY_DIRS) {
      const path = join(ordersRoot, dir);
      if (!existsSync(path)) {
        continue;
      }
      const jsFiles = readdirSync(path).filter((name) => name.endsWith('.js'));
      expect(jsFiles, `legacy ${dir}/ still contains JS implementations`).toEqual([]);
    }
  });

  it('places function-based use cases under services/', () => {
    const services = readdirSync(join(ordersRoot, 'services')).filter((f) => f.endsWith('.js'));
    expect(services).toContain('get-order.js');
    expect(services).toContain('list-orders.js');
    expect(services).toContain('order-query-service.js');
  });

  it('keeps NestJS adapters under controllers/nest without business logic imports from repositories', () => {
    const nestController = join(ordersRoot, 'controllers/nest/orders.controller.js');
    expect(existsSync(nestController)).toBe(true);
    const content = readFileSync(nestController, 'utf8');
    expect(content).not.toMatch(/repositories\//);
    expect(content).toMatch(/views\/order\.mapper\.js/);
  });

  it('does not duplicate src/app/orders after migration', () => {
    const legacyNestOrders = join(repoRoot, 'src/app/orders');
    if (!existsSync(legacyNestOrders)) {
      return;
    }
    const jsFiles = readdirSync(legacyNestOrders).filter((name) => name.endsWith('.js'));
    expect(jsFiles).toEqual([]);
  });
});
