import { describe, expect, it } from 'vitest';
import { loadConfig } from '../../src/app/config/config.js';
const baseEnv = {
    DATABASE_URL: 'postgresql://nexora:nexora@localhost:5432/nexora',
    REDIS_URL: 'redis://localhost:6379',
    STORAGE_BUCKET: 'nexora-local',
    STORAGE_ACCESS_KEY_ID: 'nexora',
    STORAGE_SECRET_ACCESS_KEY: 'nexora-secret',
    AUTH_JWT_SECRET: 'test-jwt-secret-for-unit-tests-only',
};
describe('worker observability configuration', () => {
    it('loads defaults', () => {
        const config = loadConfig({ ...baseEnv, NODE_ENV: 'test' });
        expect(config.workerObservability.httpEnabled).toBe(true);
        expect(config.workerObservability.host).toBe('127.0.0.1');
        expect(config.workerObservability.port).toBe(3001);
        expect(config.workerObservability.otelServiceName).toBe('nexora-backend-worker');
    });
    it('accepts custom host, port, and disable flag', () => {
        const config = loadConfig({
            ...baseEnv,
            NODE_ENV: 'test',
            WORKER_OBSERVABILITY_HTTP_ENABLED: 'false',
            WORKER_OBSERVABILITY_HOST: '0.0.0.0',
            WORKER_OBSERVABILITY_PORT: '4002',
        });
        expect(config.workerObservability.httpEnabled).toBe(false);
        expect(config.workerObservability.host).toBe('0.0.0.0');
        expect(config.workerObservability.port).toBe(4002);
    });
    it('uses WORKER_OTEL_SERVICE_NAME override', () => {
        const config = loadConfig({
            ...baseEnv,
            NODE_ENV: 'test',
            OTEL_SERVICE_NAME: 'nexora-backend',
            WORKER_OTEL_SERVICE_NAME: 'custom-worker',
        });
        expect(config.workerObservability.otelServiceName).toBe('custom-worker');
    });
});
