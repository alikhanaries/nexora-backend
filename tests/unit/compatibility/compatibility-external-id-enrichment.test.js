import { describe, expect, it, vi } from 'vitest';
import {
    ExternalIdMappingProvider,
    ExternalIdMappingResourceType,
} from '../../../src/modules/external-id-mapping/public/index.js';
import {
    findExternalIdsForResources,
    loadCancellationExternalIdMaps,
    loadOrderExternalIdMaps,
    loadReturnExternalIdMaps,
    loadShipmentExternalIdMaps,
} from '../../../src/modules/compatibility/application/compatibility-external-id-enrichment.js';

function buildQueryService(implementation = {}) {
    return {
        findExternalIdsByResourceIds: vi.fn(async (_tenantId, _provider, _resourceType, resourceIds) => {
            if (implementation.findExternalIdsByResourceIds) {
                return implementation.findExternalIdsByResourceIds(_tenantId, _provider, _resourceType, resourceIds);
            }
            return new Map(resourceIds.map((id, index) => [id, index + 1]));
        }),
    };
}

describe('compatibility external ID enrichment', () => {
    it('returns an empty map without querying when no resource IDs are provided', async () => {
        const queryService = buildQueryService();
        const result = await findExternalIdsForResources(
            queryService,
            'tenant-1',
            ExternalIdMappingResourceType.ORDER,
            [],
        );
        expect(result).toEqual(new Map());
        expect(queryService.findExternalIdsByResourceIds).not.toHaveBeenCalled();
    });

    it('deduplicates resource IDs before batch lookup', async () => {
        const queryService = buildQueryService();
        const resourceId = '11111111-1111-4111-8111-111111111111';
        await findExternalIdsForResources(
            queryService,
            'tenant-1',
            ExternalIdMappingResourceType.ORDER,
            [resourceId, resourceId],
        );
        expect(queryService.findExternalIdsByResourceIds).toHaveBeenCalledWith(
            'tenant-1',
            ExternalIdMappingProvider.COMPAT_V2,
            ExternalIdMappingResourceType.ORDER,
            [resourceId],
        );
    });

    it('loads order and order line mappings with bounded batch lookups', async () => {
        const queryService = buildQueryService();
        const orders = [
            {
                id: 'order-1',
                lines: [{ id: 'line-1' }, { id: 'line-2' }],
            },
            {
                id: 'order-2',
                lines: [{ id: 'line-3' }],
            },
        ];
        const maps = await loadOrderExternalIdMaps(queryService, 'tenant-1', orders);
        expect(queryService.findExternalIdsByResourceIds).toHaveBeenCalledTimes(2);
        expect(queryService.findExternalIdsByResourceIds).toHaveBeenNthCalledWith(
            1,
            'tenant-1',
            ExternalIdMappingProvider.COMPAT_V2,
            ExternalIdMappingResourceType.ORDER,
            ['order-1', 'order-2'],
        );
        expect(queryService.findExternalIdsByResourceIds).toHaveBeenNthCalledWith(
            2,
            'tenant-1',
            ExternalIdMappingProvider.COMPAT_V2,
            ExternalIdMappingResourceType.ORDER_LINE,
            ['line-1', 'line-2', 'line-3'],
        );
        expect(maps.orderIds.get('order-1')).toBe(1);
        expect(maps.orderLineIds.get('line-3')).toBe(3);
    });

    it('loads shipment, cancellation, and return mappings in one batch each', async () => {
        const queryService = buildQueryService();
        const shipments = [{ id: 'ship-1' }, { id: 'ship-2' }];
        const cancellations = [{ id: 'cancel-1' }];
        const returns = [{ id: 'return-1' }, { id: 'return-2' }];

        await loadShipmentExternalIdMaps(queryService, 'tenant-1', shipments);
        await loadCancellationExternalIdMaps(queryService, 'tenant-1', cancellations);
        await loadReturnExternalIdMaps(queryService, 'tenant-1', returns);

        expect(queryService.findExternalIdsByResourceIds).toHaveBeenCalledTimes(3);
        expect(queryService.findExternalIdsByResourceIds).toHaveBeenCalledWith(
            'tenant-1',
            ExternalIdMappingProvider.COMPAT_V2,
            ExternalIdMappingResourceType.SHIPMENT,
            ['ship-1', 'ship-2'],
        );
        expect(queryService.findExternalIdsByResourceIds).toHaveBeenCalledWith(
            'tenant-1',
            ExternalIdMappingProvider.COMPAT_V2,
            ExternalIdMappingResourceType.CANCELLATION,
            ['cancel-1'],
        );
        expect(queryService.findExternalIdsByResourceIds).toHaveBeenCalledWith(
            'tenant-1',
            ExternalIdMappingProvider.COMPAT_V2,
            ExternalIdMappingResourceType.RETURN,
            ['return-1', 'return-2'],
        );
    });
});
