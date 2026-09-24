import { ConflictError, NotFoundError, ValidationError } from '../../../shared/errors/index.js';
import { parseOrThrow } from '../../../shared/validation/index.js';
import { ChannelStatus } from '../../channels/public/index.js';
import { recordCatalogSyncOutcome } from '../../../shared/metrics/record-catalog-sync.js';
import {
    MarketplaceCatalogAdapterPermanentError,
    MarketplaceCatalogAdapterRetryError,
} from '../public/catalog-sync-adapter-errors.js';
import {
    CatalogSyncPermanentError,
    CatalogSyncRetryError,
    CatalogSyncSkippedError,
    UnsupportedMarketplaceAdapterError,
} from './catalog-sync-errors.js';
import { catalogSyncJobPayloadSchema } from './catalog-sync-job.schema.js';
import { CatalogSyncTarget } from '../domain/sync-target.js';

export class ExecuteCatalogSyncJob {
    deps;

    /**
     * @param {object} deps
     * @param {import('../../../infrastructure/postgres/postgres-database.js').PostgresDatabase} deps.database
     * @param {import('../../channels/public/index.js').DefaultChannelQueryService} deps.channelQueryService
     * @param {import('./marketplace-lookup.port.js').MarketplaceLookup} deps.marketplaceLookup
     * @param {import('../infrastructure/marketplace-catalog-adapter-registry.js').MarketplaceCatalogAdapterRegistry} deps.adapterRegistry
     * @param {import('./channel-catalog-sync-rate-limiter.js').ChannelCatalogSyncRateLimiter} deps.rateLimiter
     * @param {import('./sync-channel-inventory.js').SyncChannelInventory} deps.syncChannelInventory
     * @param {import('./sync-channel-price.js').SyncChannelPrice} deps.syncChannelPrice
     * @param {import('./sync-channel-product.js').SyncChannelProduct} deps.syncChannelProduct
     * @param {import('./sync-channel-offer.js').SyncChannelOffer} deps.syncChannelOffer
     * @param {import('../../../shared/metrics/metrics-recorder.js').MetricsRecorder} [deps.metrics]
     * @param {import('../../../shared/logging/logger.port.js').Logger} [deps.logger]
     * @param {import('../public/marketplace-adapter-runtime.port.js').MarketplaceAdapterRuntimeFactory} [deps.marketplaceAdapterRuntimeFactory]
     * @param {import('../public/marketplace-entity-mapping-recorder.port.js').MarketplaceEntityMappingRecorder} [deps.marketplaceEntityMappingRecorder]
     */
    constructor(deps) {
        this.deps = deps;
    }

    /**
     * @param {unknown} rawPayload
     */
    async execute(rawPayload) {
        let job;
        try {
            job = parseOrThrow(catalogSyncJobPayloadSchema, rawPayload, 'catalog sync job');
        }
        catch (error) {
            recordCatalogSyncOutcome(this.deps.metrics, 'invalid_payload');
            this.deps.logger?.warn({
                err: error instanceof Error ? error.message : 'validation failed',
            }, 'Catalog sync job payload rejected');
            return;
        }
        recordCatalogSyncOutcome(this.deps.metrics, 'received', {
            operation: job.target,
        });
        /** @type {{ marketplaceKey: string, operation: string } | undefined} */
        let metricContext;
        try {
            await this.deps.database.execute(async (tx) => {
                const channel = await this.deps.channelQueryService.getChannelById(job.tenantId, job.channelId);
                if (channel.tenantId !== job.tenantId) {
                    throw new CatalogSyncPermanentError('Channel tenant mismatch', {
                        tenantId: job.tenantId,
                        channelId: job.channelId,
                    });
                }
                if (channel.status !== ChannelStatus.ACTIVE) {
                    throw new CatalogSyncSkippedError('Channel is not active', {
                        channelId: channel.id,
                        status: channel.status,
                    });
                }
                const marketplace = await this.deps.marketplaceLookup.findById(channel.marketplaceId);
                if (marketplace === null) {
                    throw new CatalogSyncSkippedError('Marketplace was not found', {
                        marketplaceId: channel.marketplaceId,
                    });
                }
                if (marketplace.status !== 'ACTIVE') {
                    throw new CatalogSyncSkippedError('Marketplace is not active', {
                        marketplaceId: marketplace.id,
                        status: marketplace.status,
                    });
                }
                metricContext = { marketplaceKey: marketplace.key, operation: job.target };
                const rateLimit = await this.deps.rateLimiter.consume(job.tenantId, job.channelId);
                if (!rateLimit.allowed) {
                    recordCatalogSyncOutcome(this.deps.metrics, 'rate_limited', metricContext);
                    throw new CatalogSyncRetryError('Catalog sync rate limit exceeded', {
                        retryDelayMs: Math.max(1, rateLimit.retryAfterSeconds) * 1_000,
                    });
                }
                const adapter = this.deps.adapterRegistry.resolve(marketplace.key);
                const adapterRuntime = this.deps.marketplaceAdapterRuntimeFactory === undefined
                    ? null
                    : await this.deps.marketplaceAdapterRuntimeFactory.createForSync({
                        tenantId: job.tenantId,
                        channelId: job.channelId,
                        marketplaceKey: marketplace.key,
                        tx,
                    });
                if (job.target === CatalogSyncTarget.INVENTORY ||
                    job.target === CatalogSyncTarget.CHANNEL_INVENTORY_RESYNC) {
                    await this.deps.syncChannelInventory.execute({
                        job,
                        channel,
                        marketplace,
                        adapter,
                        adapterRuntime,
                        mappingRecorder: this.deps.marketplaceEntityMappingRecorder,
                        tx,
                    });
                }
                else if (job.target === CatalogSyncTarget.PRICE) {
                    await this.deps.syncChannelPrice.execute({
                        job,
                        channel,
                        marketplace,
                        adapter,
                        adapterRuntime,
                        mappingRecorder: this.deps.marketplaceEntityMappingRecorder,
                        tx,
                    });
                }
                else if (job.target === CatalogSyncTarget.PRODUCT) {
                    await this.deps.syncChannelProduct.execute({
                        job,
                        channel,
                        marketplace,
                        adapter,
                        adapterRuntime,
                        mappingRecorder: this.deps.marketplaceEntityMappingRecorder,
                        tx,
                    });
                }
                else if (job.target === CatalogSyncTarget.OFFER) {
                    await this.deps.syncChannelOffer.execute({
                        job,
                        channel,
                        marketplace,
                        adapter,
                        adapterRuntime,
                        mappingRecorder: this.deps.marketplaceEntityMappingRecorder,
                        tx,
                    });
                }
                else {
                    await adapter.execute?.({
                        tenantId: job.tenantId,
                        channelId: job.channelId,
                        marketplaceKey: marketplace.key,
                        target: job.target,
                        entityId: job.entityId,
                        operation: job.operation,
                        sourceEventId: job.sourceEventId,
                        correlationId: job.correlationId,
                        ...(job.stockLocationId === undefined ? {} : { stockLocationId: job.stockLocationId }),
                    });
                }
            }, { tenantId: job.tenantId });
            recordCatalogSyncOutcome(this.deps.metrics, 'success', metricContext);
        }
        catch (error) {
            const ctx = metricContext ?? { operation: job.target };
            if (error instanceof CatalogSyncSkippedError) {
                this.deps.logger?.info({
                    tenantId: job.tenantId,
                    channelId: job.channelId,
                    target: job.target,
                    reason: error.message,
                }, 'Catalog sync job skipped');
                recordCatalogSyncOutcome(this.deps.metrics, 'skipped', ctx);
                return;
            }
            if (error instanceof CatalogSyncRetryError || error instanceof MarketplaceCatalogAdapterRetryError) {
                recordCatalogSyncOutcome(this.deps.metrics, 'retryable_failure', ctx);
                if (error instanceof MarketplaceCatalogAdapterRetryError) {
                    throw new CatalogSyncRetryError(error.message, {
                        retryDelayMs: error.retryDelayMs ?? 5_000,
                    });
                }
                throw error;
            }
            if (error instanceof MarketplaceCatalogAdapterPermanentError) {
                recordCatalogSyncOutcome(this.deps.metrics, 'permanent_failure', ctx);
                this.deps.logger?.warn({
                    tenantId: job.tenantId,
                    channelId: job.channelId,
                    err: error.message,
                }, 'Catalog sync permanent adapter failure');
                return;
            }
            if (error instanceof UnsupportedMarketplaceAdapterError) {
                this.deps.logger?.warn({
                    tenantId: job.tenantId,
                    channelId: job.channelId,
                    marketplaceKey: error.safeDetails?.marketplaceKey,
                }, 'Unsupported marketplace adapter');
                recordCatalogSyncOutcome(this.deps.metrics, 'adapter_unsupported', {
                    marketplaceKey: error.safeDetails?.marketplaceKey ?? 'unknown',
                    operation: job.target,
                });
                return;
            }
            if (error instanceof CatalogSyncPermanentError) {
                recordCatalogSyncOutcome(this.deps.metrics, 'permanent_failure', ctx);
                this.deps.logger?.warn({
                    tenantId: job.tenantId,
                    channelId: job.channelId,
                    err: error.message,
                }, 'Catalog sync permanent failure');
                return;
            }
            if (error instanceof ConflictError) {
                recordCatalogSyncOutcome(this.deps.metrics, 'permanent_failure', ctx);
                this.deps.logger?.warn({
                    tenantId: job.tenantId,
                    channelId: job.channelId,
                    err: error.message,
                }, 'Catalog sync conflict');
                return;
            }
            if (error instanceof ValidationError || error instanceof NotFoundError) {
                recordCatalogSyncOutcome(this.deps.metrics, 'permanent_failure', ctx);
                this.deps.logger?.warn({
                    tenantId: job.tenantId,
                    channelId: job.channelId,
                    err: error.message,
                }, 'Catalog sync rejected — tenant-scoped resource missing');
                return;
            }
            recordCatalogSyncOutcome(this.deps.metrics, 'retryable_failure', ctx);
            throw error;
        }
    }
}
