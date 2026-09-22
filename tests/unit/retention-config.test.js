import { describe, expect, it } from 'vitest';
import { loadConfig } from '../../src/app/config/config.js';
import { ConfigurationError } from '../../src/shared/errors/index.js';
const baseEnv = {
    DATABASE_URL: 'postgresql://nexora:nexora@localhost:5432/nexora',
    REDIS_URL: 'redis://localhost:6379',
    STORAGE_BUCKET: 'nexora-local',
    STORAGE_ACCESS_KEY_ID: 'nexora',
    STORAGE_SECRET_ACCESS_KEY: 'nexora-secret',
    AUTH_JWT_SECRET: 'test-jwt-secret-for-unit-tests-only',
};
describe('retention configuration', () => {
    it('loads valid retention defaults', () => {
        const config = loadConfig({ ...baseEnv, NODE_ENV: 'test' });
        expect(config.retention.outboxDays).toBe(30);
        expect(config.retention.inboxDays).toBe(30);
        expect(config.retention.idempotencyDays).toBe(7);
        expect(config.retention.batchSize).toBe(100);
        expect(config.retention.intervalMs).toBe(3_600_000);
    });
    it('accepts custom retention values', () => {
        const config = loadConfig({
            ...baseEnv,
            NODE_ENV: 'test',
            OUTBOX_RETENTION_DAYS: '14',
            INBOX_RETENTION_DAYS: '21',
            IDEMPOTENCY_RETENTION_DAYS: '3',
            RETENTION_CLEANUP_BATCH_SIZE: '50',
            RETENTION_CLEANUP_INTERVAL_MS: '120000',
        });
        expect(config.retention.outboxDays).toBe(14);
        expect(config.retention.inboxDays).toBe(21);
        expect(config.retention.idempotencyDays).toBe(3);
        expect(config.retention.batchSize).toBe(50);
        expect(config.retention.intervalMs).toBe(120_000);
    });
    it('rejects zero retention days', () => {
        expect(() => loadConfig({ ...baseEnv, OUTBOX_RETENTION_DAYS: '0' })).toThrow(ConfigurationError);
        expect(() => loadConfig({ ...baseEnv, INBOX_RETENTION_DAYS: '0' })).toThrow(ConfigurationError);
        expect(() => loadConfig({ ...baseEnv, IDEMPOTENCY_RETENTION_DAYS: '0' })).toThrow(ConfigurationError);
    });
    it('rejects negative retention values', () => {
        expect(() => loadConfig({ ...baseEnv, OUTBOX_RETENTION_DAYS: '-1' })).toThrow(ConfigurationError);
        expect(() => loadConfig({ ...baseEnv, RETENTION_CLEANUP_BATCH_SIZE: '-5' })).toThrow(ConfigurationError);
        expect(() => loadConfig({ ...baseEnv, RETENTION_CLEANUP_INTERVAL_MS: '-1000' })).toThrow(ConfigurationError);
    });
    it('rejects invalid batch size and interval bounds', () => {
        expect(() => loadConfig({ ...baseEnv, RETENTION_CLEANUP_BATCH_SIZE: '0' })).toThrow(ConfigurationError);
        expect(() => loadConfig({ ...baseEnv, RETENTION_CLEANUP_BATCH_SIZE: '1001' })).toThrow(ConfigurationError);
        expect(() => loadConfig({ ...baseEnv, RETENTION_CLEANUP_INTERVAL_MS: '1000' })).toThrow(ConfigurationError);
    });
});
