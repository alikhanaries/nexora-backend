import { describe, expect, it } from 'vitest';
import { loadConfig } from '../../src/app/config/config.js';
import { ConfigurationError } from '../../src/shared/errors/index.js';

const baseEnv = {
  DATABASE_URL: 'postgresql://nexora:nexora@localhost:5432/nexora',
  REDIS_URL: 'redis://localhost:6379',
  STORAGE_BUCKET: 'nexora-local',
  STORAGE_ACCESS_KEY_ID: 'nexora',
  STORAGE_SECRET_ACCESS_KEY: 'nexora-secret',
};

describe('configuration', () => {
  it('loads valid configuration', () => {
    const config = loadConfig({ ...baseEnv, NODE_ENV: 'test' });
    expect(config.database.url).toContain('postgresql://');
    expect(config.server.port).toBe(3000);
  });

  it('fails fast on invalid configuration', () => {
    expect(() => loadConfig({ ...baseEnv, DATABASE_URL: 'not-a-url' })).toThrow(ConfigurationError);
  });
});
