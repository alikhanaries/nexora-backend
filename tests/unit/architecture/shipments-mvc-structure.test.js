import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const repoRoot = fileURLToPath(new URL('../../../', import.meta.url));
const moduleRoot = join(repoRoot, 'src/modules/shipments');

const REQUIRED_DIRS = ['models', 'views', 'controllers', 'services', 'repositories', 'public'];
const LEGACY_DIRS = ['application', 'domain', 'infrastructure', 'presentation'];

describe('shipments module physical MVC layout', () => {
  it('has required MVC directories with implementations', () => {
    for (const dir of REQUIRED_DIRS) {
      const path = join(moduleRoot, dir);
      expect(existsSync(path), `missing ${dir}/`).toBe(true);
      expect(readdirSync(path).length, `${dir}/ is empty`).toBeGreaterThan(0);
    }
  });

  it('does not keep legacy layer folders with active code', () => {
    for (const dir of LEGACY_DIRS) {
      const path = join(moduleRoot, dir);
      if (!existsSync(path)) continue;
      const jsFiles = readdirSync(path).filter((name) => name.endsWith('.js'));
      expect(jsFiles, `legacy ${dir}/ still contains JS`).toEqual([]);
    }
  });

  it('keeps lifecycle use cases under services/', () => {
    const services = readdirSync(join(moduleRoot, 'services')).filter((f) => f.endsWith('.js'));
    expect(services).toContain('create-shipment.js');
    expect(services).toContain('ship-shipment.js');
    expect(services).toContain('shipment-command-service.js');
  });

  it('keeps NestJS adapters thin (no repository imports)', () => {
    const nestService = join(moduleRoot, 'controllers/nest/shipments.service.js');
    const content = readFileSync(nestService, 'utf8');
    expect(content).not.toMatch(/repositories\//);
    expect(content).toMatch(/views\/shipment\.mapper\.js/);
  });

  it('does not leave active implementations under src/nest/shipments', () => {
    const legacy = join(repoRoot, 'src/nest/shipments');
    if (!existsSync(legacy)) return;
    expect(readdirSync(legacy).filter((n) => n.endsWith('.js'))).toEqual([]);
  });
});
