import { describe, expect, it, vi } from 'vitest';
import { ConflictError, NotFoundError, ValidationError } from '../../../src/shared/errors/index.js';
import {
    ExternalIdMappingResourceType,
} from '../../../src/modules/external-id-mapping/public/index.js';
import {
    parseExternalIntegerId,
    resolveExternalIntegerId,
    resolveOrderForCompatibility,
    resolveOrderLineForCompatibility,
} from '../../../src/modules/compatibility/application/compatibility-external-id-resolution.js';

function buildQueryService(resourceId = '11111111-1111-4111-8111-111111111111') {
    return {
        findResourceIdByExternalId: vi.fn(async () => resourceId),
    };
}

describe('compatibility external ID resolution', () => {
    it('parses positive integer external IDs', () => {
        expect(parseExternalIntegerId(42)).toBe(42);
        expect(parseExternalIntegerId('100')).toBe(100);
    });

    it('rejects invalid external IDs', () => {
        expect(() => parseExternalIntegerId(0)).toThrow(ValidationError);
        expect(() => parseExternalIntegerId('abc')).toThrow(ValidationError);
    });

    it('resolves a mapped external ID to an internal UUID', async () => {
        const queryService = buildQueryService();
        const resourceId = await resolveExternalIntegerId(queryService, {
            tenantId: 'tenant-1',
            resourceType: ExternalIdMappingResourceType.ORDER,
            externalId: 7,
        });
        expect(resourceId).toBe('11111111-1111-4111-8111-111111111111');
    });

    it('throws when an external ID is unknown', async () => {
        const queryService = {
            findResourceIdByExternalId: vi.fn(async () => null),
        };
        await expect(resolveExternalIntegerId(queryService, {
            tenantId: 'tenant-1',
            resourceType: ExternalIdMappingResourceType.ORDER,
            externalId: 999,
        })).rejects.toThrow(NotFoundError);
    });

    it('rejects mismatched OrderId and MerchantOrderNo', async () => {
        const queryService = buildQueryService('other-order-id');
        const orderQueryService = {
            findOrderByOrderNumber: vi.fn(async () => ({
                id: '11111111-1111-4111-8111-111111111111',
                orderNumber: 'ORD-1',
            })),
        };
        await expect(resolveOrderForCompatibility(
            queryService,
            'tenant-1',
            42,
            'ORD-1',
            orderQueryService,
        )).rejects.toThrow(ConflictError);
    });

    it('rejects order lines that do not belong to the order', async () => {
        const queryService = buildQueryService('line-from-other-order');
        await expect(resolveOrderLineForCompatibility(
            queryService,
            'tenant-1',
            5,
            [{ id: 'line-1', merchantSku: 'SKU-A' }],
            'SKU-A',
        )).rejects.toThrow(ConflictError);
    });
});
