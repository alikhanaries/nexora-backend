import {
    ExternalIdMappingProvider,
    ExternalIdMappingResourceType,
} from '../../external-id-mapping/public/index.js';

/**
 * Assigns compat_v2 external integer IDs for an order and its persisted lines.
 *
 * @param {import('../../external-id-mapping/public/external-integer-id-mapping-command-service.js').ExternalIntegerIdMappingCommandService} commandService
 * @param {object} transaction
 * @param {string} tenantId
 * @param {string} orderId
 * @param {readonly { id: string }[]} orderLines
 */
export async function assignOrderCompatibilityExternalIds(commandService, transaction, tenantId, orderId, orderLines) {
    await commandService.assignMapping(transaction, {
        tenantId,
        provider: ExternalIdMappingProvider.COMPAT_V2,
        resourceType: ExternalIdMappingResourceType.ORDER,
        resourceId: orderId,
    });
    for (const orderLine of orderLines) {
        await commandService.assignMapping(transaction, {
            tenantId,
            provider: ExternalIdMappingProvider.COMPAT_V2,
            resourceType: ExternalIdMappingResourceType.ORDER_LINE,
            resourceId: orderLine.id,
        });
    }
}
