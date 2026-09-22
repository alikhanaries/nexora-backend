import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createApplication } from '../../src/app/bootstrap/create-application.js';
import { AUTH_RATE_LIMIT_POLICIES } from '../../src/shared/auth/rate-limit-policies.js';
import { apiKeyHeaders, authHeaders, createAuthenticatedUser, createAuthenticatedUserWithSystemRole, createTestTenant, } from './auth-helpers.js';
import { closeTestInfrastructure, getTestInfrastructure } from './helpers.js';
describe('api keys integration', () => {
    beforeAll(async () => {
        await getTestInfrastructure();
    });
    afterAll(async () => {
        await closeTestInfrastructure();
    });
    it('rejects API key creation without api_keys.manage', async () => {
        const infra = await getTestInfrastructure();
        const app = await createApplication(infra);
        await app.httpServer.ready();
        const tenant = await createTestTenant(app.httpServer);
        const viewer = await createAuthenticatedUserWithSystemRole(app, tenant.tenantId, tenant.slug, 'viewer');
        const response = await app.httpServer.inject({
            method: 'POST',
            url: '/api/v1/api-keys',
            headers: authHeaders(viewer.accessToken),
            payload: {
                name: 'Should fail',
                scopes: ['orders.read'],
            },
        });
        expect(response.statusCode).toBe(403);
        expect(response.json().error.message).toContain('api_keys.manage');
        await app.httpServer.close();
    });
    it('creates, lists, and authenticates with an API key', async () => {
        const infra = await getTestInfrastructure();
        const app = await createApplication(infra);
        await app.httpServer.ready();
        const tenant = await createTestTenant(app.httpServer);
        const user = await createAuthenticatedUser(app, tenant.tenantId, tenant.slug);
        const permissions = await app.authorization.useCases.getEffectivePermissions.execute({
            tenantId: tenant.tenantId,
            actorPermissions: ['roles.read'],
            membershipId: user.membershipId,
        });
        const created = await app.apiKeys.useCases.createApiKey.execute({
            tenantId: tenant.tenantId,
            actorId: user.userId,
            actorPermissions: permissions.permissions,
            name: 'Integration key',
            scopes: ['orders.read', 'products.read'],
        });
        const secret = created.secret;
        const list = await app.httpServer.inject({
            method: 'GET',
            url: '/api/v1/api-keys',
            headers: authHeaders(user.accessToken),
        });
        expect(list.statusCode).toBe(200);
        expect(list.json().data.length).toBeGreaterThanOrEqual(1);
        const authed = await app.httpServer.inject({
            method: 'GET',
            url: '/api/v1/roles',
            headers: apiKeyHeaders(secret),
        });
        expect(authed.statusCode).toBe(403);
        await app.httpServer.close();
    });
    it('enforces api key create rate limiting', async () => {
        const infra = await getTestInfrastructure();
        const app = await createApplication(infra);
        await app.httpServer.ready();
        const tenant = await createTestTenant(app.httpServer);
        const user = await createAuthenticatedUser(app, tenant.tenantId, tenant.slug);
        const subject = `${tenant.tenantId}:${user.userId}`;
        await infra.rateLimiter.reset({
            policy: AUTH_RATE_LIMIT_POLICIES.apiKeyCreate,
            subject,
        });
        for (let attempt = 0; attempt < AUTH_RATE_LIMIT_POLICIES.apiKeyCreate.limit; attempt += 1) {
            const response = await app.httpServer.inject({
                method: 'POST',
                url: '/api/v1/api-keys',
                headers: authHeaders(user.accessToken),
                payload: {
                    name: `Key ${attempt}`,
                    scopes: ['orders.read'],
                },
            });
            expect(response.statusCode).toBe(201);
        }
        const limited = await app.httpServer.inject({
            method: 'POST',
            url: '/api/v1/api-keys',
            headers: authHeaders(user.accessToken),
            payload: {
                name: 'Limited',
                scopes: ['orders.read'],
            },
        });
        expect(limited.statusCode).toBe(429);
        await app.httpServer.close();
    });
    it('rejects scopes that exceed caller permissions', async () => {
        const infra = await getTestInfrastructure();
        const app = await createApplication(infra);
        await app.httpServer.ready();
        const tenant = await createTestTenant(app.httpServer);
        const user = await createAuthenticatedUser(app, tenant.tenantId, tenant.slug);
        await expect(app.apiKeys.useCases.createApiKey.execute({
            tenantId: tenant.tenantId,
            actorId: user.userId,
            actorPermissions: ['api_keys.manage', 'orders.read'],
            name: 'Over scoped',
            scopes: ['roles.manage'],
        })).rejects.toMatchObject({ name: 'ValidationError' });
        await app.httpServer.close();
    });
});
