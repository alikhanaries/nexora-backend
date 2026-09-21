import { afterAll, describe, expect, it } from 'vitest';
import { loadConfig } from '../../src/app/config/config.js';
import { createApplication } from '../../src/app/bootstrap/create-application.js';
import { createInfrastructure } from '../../src/app/bootstrap/create-infrastructure.js';
import { AUTH_RATE_LIMIT_POLICIES } from '../../src/shared/auth/rate-limit-policies.js';
import { createAuthenticatedUser, createTestTenant } from './auth-helpers.js';
import { closeTestInfrastructure, getTestInfrastructure } from './helpers.js';
describe('auth rate limiting integration', () => {
    afterAll(async () => {
        await closeTestInfrastructure();
    });
    it('allows requests below the login limit and rejects beyond it', async () => {
        const infra = await getTestInfrastructure();
        const app = await createApplication(infra);
        await app.httpServer.ready();
        const tenant = await createTestTenant(app.httpServer);
        const subject = `127.0.0.1:${tenant.slug}`;
        await infra.rateLimiter.reset({
            policy: AUTH_RATE_LIMIT_POLICIES.login,
            subject,
        });
        for (let attempt = 0; attempt < AUTH_RATE_LIMIT_POLICIES.login.limit; attempt += 1) {
            const response = await app.httpServer.inject({
                method: 'POST',
                url: '/api/v1/auth/login',
                payload: {
                    tenantSlug: tenant.slug,
                    email: 'wrong@example.com',
                    password: 'wrong-password',
                },
            });
            expect(response.statusCode).toBe(401);
        }
        const limited = await app.httpServer.inject({
            method: 'POST',
            url: '/api/v1/auth/login',
            payload: {
                tenantSlug: tenant.slug,
                email: 'wrong@example.com',
                password: 'wrong-password',
            },
        });
        expect(limited.statusCode).toBe(429);
        await app.httpServer.close();
    });
    it('allows refresh below the configured limit', async () => {
        const infra = await getTestInfrastructure();
        const app = await createApplication(infra);
        await app.httpServer.ready();
        const tenant = await createTestTenant(app.httpServer);
        const user = await createAuthenticatedUser(app, tenant.tenantId, tenant.slug);
        const refresh = await app.httpServer.inject({
            method: 'POST',
            url: '/api/v1/auth/refresh',
            payload: { refreshToken: user.refreshToken },
        });
        expect(refresh.statusCode).toBe(200);
        await app.httpServer.close();
    });
    it('fails closed when redis is unavailable for login rate limiting', async () => {
        const config = loadConfig(process.env);
        const infra = await createInfrastructure(config);
        const app = await createApplication(infra);
        await app.httpServer.ready();
        await infra.redis.close();
        const response = await app.httpServer.inject({
            method: 'POST',
            url: '/api/v1/auth/login',
            payload: {
                tenantSlug: 'any-tenant',
                email: 'user@example.com',
                password: 'SecurePassword123!',
            },
        });
        expect(response.statusCode).toBe(503);
        await app.httpServer.close();
        await infra.database.close();
    });
});
