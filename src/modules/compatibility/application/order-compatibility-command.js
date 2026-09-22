import { BusinessRuleError } from '../../../shared/errors/index.js';
import {
    fingerprintAcknowledgeCommand,
    mapAcknowledgeResultToExternalResponse,
    mapExternalAcknowledgeRequest,
} from './mappers/compatibility-acknowledge.mapper.js';
import {
    fingerprintChannelOrderCommand,
    mapChannelOrderResultToExternalResponse,
    mapExternalChannelOrderRequest,
    resolveChannelStockLocationId,
} from './mappers/compatibility-channel-order.mapper.js';

const ACKNOWLEDGE_ROUTE_ID = 'POST /api/v2/orders/acknowledge';
const CREATE_CHANNEL_ORDER_ROUTE_ID = 'POST /api/v2/orders';

export class OrderCompatibilityCommand {
    deps;

    /**
     * @param {object} deps
     * @param {import('../../orders/public/order-command-service.js').DefaultOrderCommandService} deps.orderCommandService
     * @param {import('../../channels/public/channel-query-service.js').DefaultChannelQueryService} deps.channelQueryService
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
     * @param {string|null|undefined} input.apiKeyChannelId
     * @param {string|null|undefined} input.channelExternalReference
     * @param {object} input.body
     * @param {string} input.idempotencyKey
     * @param {string} input.principalFingerprint
     */
    async createChannelOrder(input) {
        const channel = await this.resolveChannelContext(input);
        const stockLocationId = resolveChannelStockLocationId(channel);
        const mapped = mapExternalChannelOrderRequest(input.body, {
            channelId: channel.id,
            stockLocationId,
        });
        const { order } = await this.deps.orderCommandService.createChannelOrder({
            tenantId: input.tenantId,
            actorId: input.actorId,
            actorKind: input.actorKind,
            actorPermissions: input.actorPermissions,
            channelId: mapped.channelId,
            externalOrderReference: mapped.externalOrderReference,
            currency: mapped.currency,
            lines: mapped.lines,
            customer: mapped.customer,
            shippingMinor: mapped.shippingMinor,
            idempotencyKey: input.idempotencyKey,
            principalFingerprint: input.principalFingerprint,
            requestFingerprint: fingerprintChannelOrderCommand(mapped),
            routeId: CREATE_CHANNEL_ORDER_ROUTE_ID,
        });
        return mapChannelOrderResultToExternalResponse({ order, channel });
    }

    /**
     * @param {object} input
     * @param {string} input.tenantId
     * @param {string|null|undefined} input.apiKeyChannelId
     * @param {string|null|undefined} input.channelExternalReference
     */
    async resolveChannelContext(input) {
        if (input.apiKeyChannelId !== undefined) {
            return this.deps.channelQueryService.verifyChannelUsable(input.tenantId, input.apiKeyChannelId);
        }
        const channelExternalReference = input.channelExternalReference?.trim();
        if (channelExternalReference !== undefined && channelExternalReference.length > 0) {
            const channel = await this.deps.channelQueryService.getChannelByExternalReference(
                input.tenantId,
                channelExternalReference,
            );
            return this.deps.channelQueryService.verifyChannelUsable(input.tenantId, channel.id);
        }
        throw new BusinessRuleError('Channel context is required for channel order ingestion');
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
