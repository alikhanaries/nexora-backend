import { describe, expect, it } from 'vitest';
import { loadConfig } from '../../src/app/config/config.js';
import { ConfigurationError } from '../../src/shared/errors/index.js';
const baseEnv = {
    DATABASE_URL: 'postgresql://wasl_app:wasl@localhost:5432/wasl',
    REDIS_URL: 'redis://localhost:6379',
    STORAGE_BUCKET: 'wasl-local',
    STORAGE_ACCESS_KEY_ID: 'wasl',
    STORAGE_SECRET_ACCESS_KEY: 'wasl-secret',
    AUTH_JWT_SECRET: 'test-jwt-secret-for-unit-tests-only',
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

    it('rejects the development MFA encryption placeholder in production', () => {
        expect(() =>
            loadConfig({
                ...baseEnv,
                NODE_ENV: 'production',
                AUTH_MFA_ENCRYPTION_KEY: '0123456789abcdef0123456789abcdef',
            }),
        ).toThrow(ConfigurationError);
    });
});
