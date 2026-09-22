import { afterAll, describe, expect, it } from 'vitest';
import { loadConfig } from '../../src/app/config/config.js';
import { createApplication } from '../../src/app/bootstrap/create-application.js';
import { createInfrastructure } from '../../src/app/bootstrap/create-infrastructure.js';
import { COMPATIBILITY_RATE_LIMIT_POLICIES } from '../../src/shared/auth/rate-limit-policies.js';
import { compatibilityRateLimitSubject } from '../../src/shared/auth/compatibility-rate-limit-subject.js';
import { authHeaders, createAuthenticatedUser, createTestTenant } from './auth-helpers.js';
import { closeTestInfrastructure, getTestInfrastructure } from './helpers.js';

describe('compatibility rate limiting integration', () => {
    afterAll(async () => {
        await closeTestInfrastructure();
    });

    it('allows compatibility requests below the read limit', async () => {
        const infra = await getTestInfrastructure();
        const app = await createApplication(infra);
        await app.httpServer.ready();
        const tenant = await createTestTenant(app.httpServer);
        const user = await createAuthenticatedUser(app, tenant.tenantId, tenant.slug);
        const subject = compatibilityRateLimitSubject({
            tenantId: tenant.tenantId,
            userId: user.userId,
        }, 'read');
        await infra.rateLimiter.reset({
            policy: COMPATIBILITY_RATE_LIMIT_POLICIES.read,
            subject,
        });
        const response = await app.httpServer.inject({
            method: 'GET',
            url: '/api/v2/foundation/ping',
            headers: authHeaders(user.accessToken),
        });
        expect(response.statusCode).toBe(200);
        await app.httpServer.close();
    });

    it('returns 429 when the read limit is exceeded', async () => {
        const infra = await getTestInfrastructure();
        const app = await createApplication(infra);
        await app.httpServer.ready();
        const tenant = await createTestTenant(app.httpServer);
        const user = await createAuthenticatedUser(app, tenant.tenantId, tenant.slug);
        const subject = compatibilityRateLimitSubject({
            tenantId: tenant.tenantId,
            userId: user.userId,
        }, 'read');
        await infra.rateLimiter.reset({
            policy: COMPATIBILITY_RATE_LIMIT_POLICIES.read,
            subject,
        });
        for (let attempt = 0; attempt < COMPATIBILITY_RATE_LIMIT_POLICIES.read.limit; attempt += 1) {
            await infra.rateLimiter.consume({
                policy: COMPATIBILITY_RATE_LIMIT_POLICIES.read,
                subject,
            });
        }
        const limited = await app.httpServer.inject({
            method: 'GET',
            url: '/api/v2/foundation/ping',
            headers: authHeaders(user.accessToken),
        });
        expect(limited.statusCode).toBe(429);
        expect(limited.headers['retry-after']).toBeDefined();
        await app.httpServer.close();
    });

    it('isolates rate limits per tenant', async () => {
        const infra = await getTestInfrastructure();
        const app = await createApplication(infra);
        await app.httpServer.ready();
        const tenantA = await createTestTenant(app.httpServer);
        const tenantB = await createTestTenant(app.httpServer);
        const userA = await createAuthenticatedUser(app, tenantA.tenantId, tenantA.slug);
        const userB = await createAuthenticatedUser(app, tenantB.tenantId, tenantB.slug);
        const subjectA = compatibilityRateLimitSubject({
            tenantId: tenantA.tenantId,
            userId: userA.userId,
        }, 'read');
        await infra.rateLimiter.reset({
            policy: COMPATIBILITY_RATE_LIMIT_POLICIES.read,
            subject: subjectA,
        });
        for (let attempt = 0; attempt < COMPATIBILITY_RATE_LIMIT_POLICIES.read.limit; attempt += 1) {
            await infra.rateLimiter.consume({
                policy: COMPATIBILITY_RATE_LIMIT_POLICIES.read,
                subject: subjectA,
            });
        }
        const limitedA = await app.httpServer.inject({
            method: 'GET',
            url: '/api/v2/foundation/ping',
            headers: authHeaders(userA.accessToken),
        });
        expect(limitedA.statusCode).toBe(429);
        const allowedB = await app.httpServer.inject({
            method: 'GET',
            url: '/api/v2/foundation/ping',
            headers: authHeaders(userB.accessToken),
        });
        expect(allowedB.statusCode).toBe(200);
        await app.httpServer.close();
    });

    it('fails closed when redis is unavailable for compatibility rate limiting', async () => {
        const config = loadConfig(process.env);
        const infra = await createInfrastructure(config);
        const app = await createApplication(infra);
        await app.httpServer.ready();
        const tenant = await createTestTenant(app.httpServer);
        const user = await createAuthenticatedUser(app, tenant.tenantId, tenant.slug);
        await infra.redis.close();
        const response = await app.httpServer.inject({
            method: 'GET',
            url: '/api/v2/foundation/ping',
            headers: authHeaders(user.accessToken),
        });
        expect(response.statusCode).toBe(503);
        await app.httpServer.close();
        await infra.database.close();
    });
});
