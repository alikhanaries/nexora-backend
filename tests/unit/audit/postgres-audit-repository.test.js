import { describe, expect, it, vi } from 'vitest';
import { createPostgresAuditRepository } from '../../../src/modules/audit/repositories/postgres-audit-repository.js';

describe('createPostgresAuditRepository', () => {
    it('redacts metadata before insert', async () => {
        const query = vi.fn().mockResolvedValue({ rows: [] });
        const repository = createPostgresAuditRepository();

        await repository.insert({ query }, {
            tenantId: '11111111-1111-4111-8111-111111111111',
            actorKind: 'user',
            actorId: 'user-1',
            eventType: 'LOGIN_SUCCESS',
            metadata: { password: 'secret', ok: true },
        });

        expect(query).toHaveBeenCalledTimes(1);
        const params = query.mock.calls[0][1];
        const metadataJson = JSON.parse(params[7]);
        expect(metadataJson.password).not.toBe('secret');
        expect(metadataJson.ok).toBe(true);
    });

    it('lists tenant-scoped events with pagination bounds', async () => {
        const query = vi
            .fn()
            .mockResolvedValueOnce({ rows: [{ total: 2 }] })
            .mockResolvedValueOnce({
                rows: [
                    {
                        id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
                        tenant_id: '11111111-1111-4111-8111-111111111111',
                        actor_kind: 'user',
                        actor_id: 'user-1',
                        event_type: 'LOGIN_SUCCESS',
                        resource_type: null,
                        resource_id: null,
                        metadata: {},
                        ip_address: null,
                        request_id: null,
                        created_at: new Date('2026-01-01T00:00:00.000Z'),
                    },
                ],
            });

        const repository = createPostgresAuditRepository();
        const result = await repository.list({ query }, {
            tenantId: '11111111-1111-4111-8111-111111111111',
            limit: 999,
            offset: -3,
        });

        expect(result.total).toBe(2);
        expect(result.events).toHaveLength(1);
        expect(result.events[0].eventType).toBe('LOGIN_SUCCESS');
        const listParams = query.mock.calls[1][1];
        expect(listParams.at(-2)).toBe(200);
        expect(listParams.at(-1)).toBe(0);
    });
});
