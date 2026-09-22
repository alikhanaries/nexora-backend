import {
    fingerprintAcknowledgeCommand,
    mapAcknowledgeResultToExternalResponse,
    mapExternalAcknowledgeRequest,
} from './mappers/compatibility-acknowledge.mapper.js';

const ACKNOWLEDGE_ROUTE_ID = 'POST /api/v2/orders/acknowledge';

export class OrderCompatibilityCommand {
    deps;

    /**
     * @param {object} deps
     * @param {import('../../orders/public/order-command-service.js').DefaultOrderCommandService} deps.orderCommandService
     */
    constructor(deps) {
        this.deps = deps;
    }

    /**
     * @param {object} input
     * @param {string} input.tenantId
     * @param {string} input.actorId
     * @param {'user'|'api-key'} input.actorKind
     * @param {readonly string[]} input.actorPermissions
     * @param {{ MerchantOrderNo: string, OrderId: string|number }} input.body
     * @param {string} input.idempotencyKey
     * @param {string} input.principalFingerprint
     */
    async acknowledgeOrder(input) {
        const mapped = mapExternalAcknowledgeRequest(input.body);
        const { order } = await this.deps.orderCommandService.acknowledgeOrder({
            tenantId: input.tenantId,
            actorId: input.actorId,
            actorKind: input.actorKind,
            actorPermissions: input.actorPermissions,
            orderNumber: mapped.orderNumber,
            idempotencyKey: input.idempotencyKey,
            principalFingerprint: input.principalFingerprint,
            requestFingerprint: fingerprintAcknowledgeCommand(mapped),
            routeId: ACKNOWLEDGE_ROUTE_ID,
        });
        return mapAcknowledgeResultToExternalResponse({ order });
    }
}
