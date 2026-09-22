import { describe, expect, it, vi } from 'vitest';
import { CreateApiKeyUseCase } from '../../../src/modules/api-keys/application/use-cases/create-api-key.js';
import { AuthorizationError } from '../../../src/shared/errors/index.js';

function createDeps() {
    return {
        db: {
            execute: vi.fn(async (work) => work({
                query: vi.fn(),
            })),
        },
        apiKeys: {
            create: vi.fn(async () => ({
                id: '11111111-1111-1111-1111-111111111111',
                prefix: 'nxk_test',
                name: 'Test',
                scopes: ['orders.read'],
                keyType: 'STANDARD',
                expiresAt: null,
            })),
        },
        rateLimiter: {
            consume: vi.fn(async () => ({ allowed: true, retryAfterSeconds: 0 })),
        },
        auditRecorder: {
            record: vi.fn(async () => undefined),
        },
    };
}

describe('CreateApiKeyUseCase authorization', () => {
    it('requires api_keys.manage', async () => {
        const deps = createDeps();
        const useCase = new CreateApiKeyUseCase(deps);
        await expect(useCase.execute({
            tenantId: '22222222-2222-2222-2222-222222222222',
            actorId: '33333333-3333-3333-3333-333333333333',
            actorPermissions: ['api_keys.read'],
            name: 'Denied',
            scopes: ['orders.read'],
        })).rejects.toBeInstanceOf(AuthorizationError);
        expect(deps.rateLimiter.consume).not.toHaveBeenCalled();
    });

    it('allows create when api_keys.manage is present', async () => {
        const deps = createDeps();
        const useCase = new CreateApiKeyUseCase(deps);
        const result = await useCase.execute({
            tenantId: '22222222-2222-2222-2222-222222222222',
            actorId: '33333333-3333-3333-3333-333333333333',
            actorPermissions: ['api_keys.manage', 'orders.read'],
            name: 'Allowed',
            scopes: ['orders.read'],
        });
        expect(result.prefix).toBe('nxk_test');
        expect(deps.rateLimiter.consume).toHaveBeenCalledOnce();
    });
});
