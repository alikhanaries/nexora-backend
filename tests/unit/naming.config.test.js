import { describe, expect, it } from 'vitest';
import {
  WASL_NAMING,
  getExternalCompatibilityEntry,
  validateWaslNaming,
} from '../../src/shared/config/wasl-naming.config.js';
import { loadConfig } from '../../src/app/config/config.js';

const baseEnv = {
  DATABASE_URL: 'postgresql://app:app@localhost:5432/wasl',
  REDIS_URL: 'redis://localhost:6379',
  STORAGE_BUCKET: 'wasl-local',
  STORAGE_ACCESS_KEY_ID: 'wasl',
  STORAGE_SECRET_ACCESS_KEY: 'wasl-secret',
  AUTH_JWT_SECRET: 'test-jwt-secret-for-unit-tests-only',
};

describe('Wasl naming configuration', () => {
  it('defines canonical platform identity', () => {
    expect(validateWaslNaming(WASL_NAMING)).toEqual([]);
    expect(WASL_NAMING.backendServiceId).toBe('wasl-backend');
    expect(WASL_NAMING.applicationDisplayName).toBe('Wasl');
    expect(WASL_NAMING.application.backendServiceId).toBe('wasl-backend');
    expect(WASL_NAMING.integrations.foundationStubMarketplaceKey).toBe('wasl-foundation-stub');
    expect(WASL_NAMING.infrastructure.queue.logicalNames.catalogSync).toBe('channel-catalog-sync');
    expect(WASL_NAMING.infrastructure.queue.inboxConsumers.catalogSyncEnqueue).toBe(
      'channel-catalog-sync.enqueue',
    );
    expect(WASL_NAMING.externalCompatibility.length).toBeGreaterThan(10);
  });

  it('returns null for unknown external compatibility ids', () => {
    expect(getExternalCompatibilityEntry('does-not-exist')).toBeNull();
    expect(getExternalCompatibilityEntry('webhook.header.signature')?.value).toBe('X-Wasl-Signature');
  });

  it('uses Wasl defaults in environment schema when unset', () => {
    const config = loadConfig({ ...baseEnv, NODE_ENV: 'test' });
    expect(config.appName).toBe(WASL_NAMING.backendServiceId);
    expect(config.redis.keyPrefix).toBe(WASL_NAMING.defaultRedisKeyPrefix);
    expect(config.queue.prefix).toBe(WASL_NAMING.defaultQueuePrefix);
  });
});
