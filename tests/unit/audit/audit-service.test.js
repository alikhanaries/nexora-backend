import { describe, expect, it, vi } from 'vitest';
import { AuthorizationError } from '../../../src/shared/errors/index.js';
import { createAuditService } from '../../../src/modules/audit/services/audit-service.js';

describe('createAuditService', () => {
    it('requires audit.read before listing', async () => {
        const service = createAuditService({
            repository: { list: vi.fn() },
            database: { execute: vi.fn() },
            requirePermission: () => {
                throw new AuthorizationError('Missing required permission: audit.read', {
                    permission: 'audit.read',
                });
            },
        });

        await expect(
            service.listEvents({
                tenantId: '11111111-1111-4111-8111-111111111111',
                actorPermissions: [],
            }),
        ).rejects.toBeInstanceOf(AuthorizationError);
    });

    it('lists events inside a tenant-scoped database execute', async () => {
        const list = vi.fn().mockResolvedValue({
            total: 1,
            events: [{ id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa' }],
        });
        const execute = vi.fn(async (fn, options) => {
            expect(options).toEqual({ tenantId: '11111111-1111-4111-8111-111111111111' });
            return fn({ query: vi.fn() });
        });
        const requirePermission = vi.fn();

        const service = createAuditService({
            repository: { list },
            database: { execute },
            requirePermission,
        });

        const result = await service.listEvents({
            tenantId: '11111111-1111-4111-8111-111111111111',
            actorPermissions: ['audit.read'],
            eventType: 'LOGIN_SUCCESS',
            limit: 10,
            offset: 5,
        });

        expect(requirePermission).toHaveBeenCalledWith(['audit.read'], 'audit.read');
        expect(list).toHaveBeenCalledWith(expect.anything(), {
            tenantId: '11111111-1111-4111-8111-111111111111',
            eventType: 'LOGIN_SUCCESS',
            limit: 10,
            offset: 5,
        });
        expect(result.total).toBe(1);
    });
});
