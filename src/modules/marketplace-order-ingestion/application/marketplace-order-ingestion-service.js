import { NotFoundError, ValidationError } from '../../../shared/errors/index.js';
import { parseOrThrow } from '../../../shared/validation/index.js';
import { recordMarketplaceOrderIngestionOutcome } from '../../../shared/metrics/record-marketplace-order-ingestion.js';
import { INGESTIBLE_MARKETPLACE_ORDER_STATUSES } from '../domain/normalized-marketplace-order-status.js';
import { MarketplaceOrderIngestionPermanentError } from './marketplace-order-ingestion-errors.js';
import { normalizedMarketplaceOrderSchema } from './normalized-marketplace-order.schema.js';
import { resolveMarketplaceOrderLines } from './resolve-marketplace-order-lines.js';

const SYSTEM_ACTOR_ID = 'marketplace-order-ingestion';
const INGEST_PERMISSIONS = Object.freeze(['orders.ingest']);

export class MarketplaceOrderIngestionService {
    deps;

    /**
     * @param {object} deps
     * @param {import('../../../infrastructure/postgres/postgres-database.js').PostgresDatabase} deps.database
     * @param {import('../../channels/public/index.js').DefaultChannelQueryService} deps.channelQueryService
     * @param {import('../public/marketplace-channel-lookup.port.js').MarketplaceChannelLookup} deps.marketplaceLookup
     * @param {import('../../orders/application/create-channel-order.js').CreateChannelOrder} deps.createChannelOrder
     * @param {import('../public/marketplace-entity-mapping-lookup.port.js').MarketplaceEntityMappingLookup} deps.marketplaceEntityMappingLookup
     * @param {import('../../products/public/index.js').ProductQueryService} deps.productQueryService
     * @param {import('../../../shared/metrics/metrics-recorder.js').MetricsRecorder} [deps.metrics]
     * @param {import('../../../shared/logging/logger.port.js').Logger} [deps.logger]
     */
    constructor(deps) {
        this.deps = deps;
    }

    /**
     * @param {object} input
     * @param {string} input.tenantId
     * @param {string} input.channelId
     * @param {unknown} input.order
     * @param {string} [input.correlationId]
     * @param {string} [input.jobId]
     */
    async ingest(input) {
        const order = parseOrThrow(normalizedMarketplaceOrderSchema, input.order, 'normalized marketplace order');
        const metricContext = { marketplaceKey: order.marketplaceKey, operation: 'ingest' };
        recordMarketplaceOrderIngestionOutcome(this.deps.metrics, 'received', metricContext);
        try {
            if (!INGESTIBLE_MARKETPLACE_ORDER_STATUSES.has(order.status)) {
                throw new MarketplaceOrderIngestionPermanentError('Marketplace order status is not ingestible in Phase 28', {
                    status: order.status,
                });
            }
            const channel = await this.deps.channelQueryService.getChannelById(input.tenantId, input.channelId);
            if (channel.tenantId !== input.tenantId) {
                throw new MarketplaceOrderIngestionPermanentError('Channel tenant mismatch', {
                    channelId: input.channelId,
                });
            }
            const marketplace = await this.deps.marketplaceLookup.findById(channel.marketplaceId);
            if (marketplace === null) {
                throw new MarketplaceOrderIngestionPermanentError('Channel marketplace was not found', {
                    marketplaceId: channel.marketplaceId,
                });
            }
            if (marketplace.key !== order.marketplaceKey) {
                throw new MarketplaceOrderIngestionPermanentError('Normalized order marketplaceKey does not match channel', {
                    expected: marketplace.key,
                    received: order.marketplaceKey,
                });
            }
            const externalOrderReference = order.externalOrderId.trim();
            const result = await this.deps.database.execute(async (tx) => {
                const channelLines = await resolveMarketplaceOrderLines({
                    marketplaceEntityMappingLookup: this.deps.marketplaceEntityMappingLookup,
                    productQueryService: this.deps.productQueryService,
                }, {
                    tenantId: input.tenantId,
                    channelId: input.channelId,
                    marketplaceKey: order.marketplaceKey,
                    lines: order.lines,
                    queryable: tx,
                });
                const createResult = await this.deps.createChannelOrder.execute({
                    tenantId: input.tenantId,
                    actorId: SYSTEM_ACTOR_ID,
                    actorKind: 'api-key',
                    actorPermissions: INGEST_PERMISSIONS,
                    channelId: input.channelId,
                    externalOrderReference,
                    currency: order.currency,
                    lines: channelLines,
                    ...(order.customer === undefined ? {} : { customer: order.customer }),
                    discountMinor: order.discountMinor ?? 0,
                    taxMinor: order.taxMinor ?? 0,
                    shippingMinor: order.shippingMinor ?? 0,
                    transaction: tx,
                });
                return createResult;
            }, { tenantId: input.tenantId });
            const outcome = result.ingestionOutcome === 'duplicate' ? 'duplicate' : 'created';
            recordMarketplaceOrderIngestionOutcome(this.deps.metrics, outcome, metricContext);
            this.deps.logger?.info({
                tenantId: input.tenantId,
                channelId: input.channelId,
                marketplaceKey: order.marketplaceKey,
                orderId: result.order.id,
                outcome,
                ...(input.jobId === undefined ? {} : { jobId: input.jobId }),
            }, 'Marketplace order ingested');
            return {
                outcome,
                order: result.order,
                externalOrderReference,
            };
        }
        catch (error) {
            if (error instanceof MarketplaceOrderIngestionPermanentError) {
                recordMarketplaceOrderIngestionOutcome(this.deps.metrics, 'permanent_failure', metricContext);
                throw error;
            }
            if (error instanceof ValidationError || error instanceof NotFoundError) {
                recordMarketplaceOrderIngestionOutcome(this.deps.metrics, 'permanent_failure', metricContext);
                throw new MarketplaceOrderIngestionPermanentError(error.message, error.safeDetails);
            }
            recordMarketplaceOrderIngestionOutcome(this.deps.metrics, 'retryable_failure', metricContext);
            throw error;
        }
    }
}
