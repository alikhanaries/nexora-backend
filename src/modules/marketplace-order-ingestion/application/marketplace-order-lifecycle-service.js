import { createHash } from 'node:crypto';
import { NotFoundError, ValidationError } from '../../../shared/errors/index.js';
import { parseOrThrow } from '../../../shared/validation/index.js';
import { recordMarketplaceOrderLifecycleOutcome } from '../../../shared/metrics/record-marketplace-order-lifecycle.js';
import { MarketplaceOrderLifecycleOutcome } from '../domain/marketplace-order-lifecycle-outcome.js';
import { assertMarketplaceOrderLifecycleCapability } from './marketplace-order-lifecycle-capabilities.js';
import {
    MarketplaceOrderLifecyclePermanentError,
    MarketplaceOrderLifecycleRetryError,
    MarketplaceOrderLifecycleUnsupportedError,
} from './marketplace-order-lifecycle-errors.js';
import { normalizedMarketplaceLifecycleCommandSchema } from './normalized-marketplace-lifecycle-command.schema.js';

const LIFECYCLE_ROUTE_ID = 'marketplace-order-lifecycle.apply';
const LIFECYCLE_PRINCIPAL = 'marketplace-order-lifecycle';

export class MarketplaceOrderLifecycleService {
    deps;

    /**
     * @param {object} deps
     * @param {import('../../../infrastructure/postgres/postgres-database.js').PostgresDatabase} deps.database
     * @param {import('../../channels/public/index.js').DefaultChannelQueryService} deps.channelQueryService
     * @param {import('../public/marketplace-channel-lookup.port.js').MarketplaceChannelLookup} deps.marketplaceLookup
     * @param {{ findByChannelAndExternalReference: (queryable: object, tenantId: string, channelId: string, externalOrderReference: string) => Promise<import('../../orders/domain/order.js').Order | null> }} deps.orders
     * @param {ExecuteMarketplaceOrderLifecycleOperation} deps.executeOperation
     * @param {import('../public/marketplace-order-adapter-registry.js').MarketplaceOrderAdapterRegistry} deps.orderAdapterRegistry
     * @param {import('../../../shared/idempotency/idempotency-service.js')} [deps.idempotency]
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
     * @param {unknown} input.command
     * @param {string} [input.jobId]
     */
    async apply(input) {
        const command = parseOrThrow(normalizedMarketplaceLifecycleCommandSchema, input.command, 'marketplace lifecycle command');
        const metricContext = { marketplaceKey: command.marketplaceKey, operation: command.operation };
        recordMarketplaceOrderLifecycleOutcome(this.deps.metrics, 'received', metricContext);
        try {
            await this.assertChannelContext(input.tenantId, input.channelId, command.marketplaceKey);
            const adapter = this.deps.orderAdapterRegistry.resolve(command.marketplaceKey);
            const lifecycleCaps = adapter?.getOrderLifecycleCapabilities?.();
            assertMarketplaceOrderLifecycleCapability(command.operation, lifecycleCaps, command.marketplaceKey);
            const fingerprint = this.buildRequestFingerprint(command);
            const run = async (tx) => {
                const externalOrderReference = command.externalOrderId.trim();
                const order = await this.deps.orders.findByChannelAndExternalReference(tx, input.tenantId, input.channelId, externalOrderReference);
                if (order === null) {
                    throw new MarketplaceOrderLifecyclePermanentError('Marketplace order was not found in Nexora', {
                        externalOrderId: externalOrderReference,
                        channelId: input.channelId,
                    });
                }
                if (order.channelId !== input.channelId || order.tenantId !== input.tenantId) {
                    throw new MarketplaceOrderLifecyclePermanentError('Order channel or tenant mismatch', {
                        orderId: order.id,
                    });
                }
                return this.deps.executeOperation.execute({
                    tenantId: input.tenantId,
                    channelId: input.channelId,
                }, command, order, tx);
            };
            let result;
            if (this.deps.idempotency === undefined) {
                result = await this.deps.database.execute(run, { tenantId: input.tenantId });
            }
            else {
                const outcome = await this.deps.idempotency.execute({
                    tenantId: input.tenantId,
                    principalFingerprint: LIFECYCLE_PRINCIPAL,
                    routeId: LIFECYCLE_ROUTE_ID,
                    idempotencyKey: command.externalEventId,
                }, fingerprint, run, (result) => ({ statusCode: 200, body: result }), { useTransaction: true });
                if (outcome.kind === 'replayed') {
                    recordMarketplaceOrderLifecycleOutcome(this.deps.metrics, MarketplaceOrderLifecycleOutcome.DUPLICATE, metricContext);
                    const stored = outcome.value;
                    const payload = stored !== null && typeof stored === 'object' && 'body' in stored
                        ? stored.body
                        : stored;
                    return {
                        ...payload,
                        outcome: MarketplaceOrderLifecycleOutcome.DUPLICATE,
                    };
                }
                result = outcome.value;
            }
            recordMarketplaceOrderLifecycleOutcome(this.deps.metrics, result.outcome, metricContext);
            this.deps.logger?.info({
                tenantId: input.tenantId,
                channelId: input.channelId,
                marketplaceKey: command.marketplaceKey,
                operation: command.operation,
                outcome: result.outcome,
                orderId: result.orderId,
                ...(input.jobId === undefined ? {} : { jobId: input.jobId }),
            }, 'Marketplace order lifecycle applied');
            return result;
        }
        catch (error) {
            if (error instanceof MarketplaceOrderLifecycleUnsupportedError) {
                recordMarketplaceOrderLifecycleOutcome(this.deps.metrics, MarketplaceOrderLifecycleOutcome.UNSUPPORTED, metricContext);
                throw error;
            }
            if (error instanceof MarketplaceOrderLifecyclePermanentError) {
                recordMarketplaceOrderLifecycleOutcome(this.deps.metrics, 'permanent_failure', metricContext);
                throw error;
            }
            if (error instanceof ValidationError || error instanceof NotFoundError) {
                recordMarketplaceOrderLifecycleOutcome(this.deps.metrics, 'permanent_failure', metricContext);
                throw new MarketplaceOrderLifecyclePermanentError(error.message, error.safeDetails);
            }
            recordMarketplaceOrderLifecycleOutcome(this.deps.metrics, 'retryable_failure', metricContext);
            if (error instanceof MarketplaceOrderLifecycleRetryError) {
                throw error;
            }
            throw error;
        }
    }

    /**
     * @param {string} tenantId
     * @param {string} channelId
     * @param {string} marketplaceKey
     */
    async assertChannelContext(tenantId, channelId, marketplaceKey) {
        const channel = await this.deps.channelQueryService.getChannelById(tenantId, channelId);
        if (channel.tenantId !== tenantId) {
            throw new MarketplaceOrderLifecyclePermanentError('Channel tenant mismatch', { channelId });
        }
        const marketplace = await this.deps.marketplaceLookup.findById(channel.marketplaceId);
        if (marketplace === null) {
            throw new MarketplaceOrderLifecyclePermanentError('Channel marketplace was not found', {
                marketplaceId: channel.marketplaceId,
            });
        }
        if (marketplace.key !== marketplaceKey) {
            throw new MarketplaceOrderLifecyclePermanentError('Lifecycle command marketplaceKey does not match channel', {
                expected: marketplace.key,
                received: marketplaceKey,
            });
        }
    }

    /**
     * @param {import('./normalized-marketplace-lifecycle-command.schema.js').normalizedMarketplaceLifecycleCommandSchema['_output']} command
     */
    buildRequestFingerprint(command) {
        return createHash('sha256').update(JSON.stringify(command)).digest('hex');
    }
}
