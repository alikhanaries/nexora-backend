import { describe, expect, it, vi } from 'vitest';
import { withChannelQueryable } from '../../../src/modules/commerce-integrations/services/resolve-commerce-integration-queryable.js';
import { createCommerceIntegrationQueryService } from '../../../src/modules/commerce-integrations/services/commerce-integration-query-service.js';

describe('withChannelQueryable tenant context', () => {
    it('uses database.withTenant when no tx is provided', async () => {
        const queryable = { kind: 'bare-queryable' };
        const tenantTx = { kind: 'tenant-tx' };
        const withTenant = vi.fn(async (_tenantId, work) => work(tenantTx));
        const work = vi.fn(async (q) => q.kind);

        const result = await withChannelQueryable(
            { queryable, database: { withTenant } },
            'tenant-a',
            undefined,
            work,
        );

        expect(withTenant).toHaveBeenCalledWith('tenant-a', work);
        expect(work).toHaveBeenCalledWith(tenantTx);
        expect(result).toBe('tenant-tx');
    });

    it('falls back to bare queryable when database.withTenant is absent', async () => {
        const queryable = { kind: 'bare-queryable' };
        const work = vi.fn(async (q) => q.kind);

        const result = await withChannelQueryable({ queryable }, 'tenant-a', undefined, work);

        expect(work).toHaveBeenCalledWith(queryable);
        expect(result).toBe('bare-queryable');
    });
});

describe('CommerceIntegrationQueryService worker-style wiring', () => {
    it('resolves a tenant-scoped channel when database.withTenant is injected', async () => {
        const channel = {
            id: 'channel-1',
            tenantId: 'tenant-a',
            status: 'ACTIVE',
        };
        const getCommerceIntegrationById = vi.fn(async () => channel);
        const withTenant = vi.fn(async (_tenantId, work) => work({ kind: 'tenant-tx' }));

        const service = createCommerceIntegrationQueryService({
            queryable: { kind: 'bare-queryable' },
            database: { withTenant },
            getCommerceIntegrationById,
            getCommerceIntegrationByExternalReference: vi.fn(),
            listCommerceIntegrations: vi.fn(),
        });

        const found = await service.getCommerceIntegrationById('tenant-a', 'channel-1');

        expect(withTenant).toHaveBeenCalledWith('tenant-a', expect.any(Function));
        expect(getCommerceIntegrationById).toHaveBeenCalledWith('tenant-a', 'channel-1', {
            kind: 'tenant-tx',
        });
        expect(found).toBe(channel);
    });

    it('looks up against bare queryable without withTenant (RLS-blind path)', async () => {
        const getCommerceIntegrationById = vi.fn(async () => null);
        const service = createCommerceIntegrationQueryService({
            queryable: { kind: 'bare-queryable' },
            getCommerceIntegrationById,
            getCommerceIntegrationByExternalReference: vi.fn(),
            listCommerceIntegrations: vi.fn(),
        });

        await expect(service.getCommerceIntegrationById('tenant-a', 'channel-1')).rejects.toMatchObject({
            name: 'NotFoundError',
            message: 'Channel was not found',
        });
        expect(getCommerceIntegrationById).toHaveBeenCalledWith('tenant-a', 'channel-1', {
            kind: 'bare-queryable',
        });
    });
});
