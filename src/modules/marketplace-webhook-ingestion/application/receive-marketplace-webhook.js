import { fingerprintRequest } from '../../../shared/idempotency/index.js';
import { parseOrThrow } from '../../../shared/validation/index.js';
import { recordMarketplaceWebhookOutcome } from '../../../shared/metrics/record-marketplace-webhook.js';
import {
    MarketplaceWebhookAuthenticationError,
    MarketplaceWebhookPermanentError,
    MarketplaceWebhookRetryableError,
    MarketplaceWebhookUnsupportedError,
} from './marketplace-webhook-errors.js';
import { normalizedMarketplaceWebhookEventSchema } from './normalized-marketplace-webhook-event.schema.js';
import {
    MarketplaceOrderIngestionPermanentError,
    MarketplaceOrderIngestionRetryError,
} from '../../marketplace-order-ingestion/public/marketplace-order-ingestion-errors.js';
import { MarketplaceOrderLifecycleRetryError } from '../../marketplace-order-ingestion/public/marketplace-order-lifecycle-errors.js';

const ROUTE_ID = 'POST /api/v1/inbound/marketplace-webhooks/:ingressToken';

export class ReceiveMarketplaceWebhook {
    deps;

    /**
     * @param {object} deps
     * @param {import('./resolve-marketplace-webhook-connection.js').ResolveMarketplaceWebhookConnection} deps.resolveConnection
     * @param {import('../public/marketplace-webhook-adapter-registry.js').MarketplaceWebhookAdapterRegistry} deps.webhookAdapterRegistry
     * @param {import('./marketplace-order-lifecycle-processor.js').MarketplaceOrderLifecycleProcessor} deps.orderLifecycleProcessor
     * @param {import('../../../infrastructure/postgres/idempotency-service.js').PostgresIdempotencyService} deps.idempotency
     * @param {import('../../../shared/metrics/metrics-recorder.js').MetricsRecorder} [deps.metrics]
     * @param {import('../../../shared/logging/logger.port.js').Logger} [deps.logger]
     */
    constructor(deps) {
        this.deps = deps;
    }

    /**
     * @param {object} input
     * @param {string} input.ingressToken
     * @param {Record<string, string | string[] | undefined>} input.headers
     * @param {string} input.rawBody
     * @param {string|null} [input.correlationId]
     */
    async execute(input) {
        const connection = await this.deps.resolveConnection.execute(input.ingressToken);
        const metricBase = { marketplaceKey: connection.marketplaceKey, operation: 'webhook' };
        recordMarketplaceWebhookOutcome(this.deps.metrics, 'received', metricBase);
        const adapter = this.deps.webhookAdapterRegistry.resolve(connection.marketplaceKey);
        const capabilities = adapter?.getWebhookCapabilities?.();
        if (adapter === null || capabilities?.supportsInboundWebhooks !== true) {
            recordMarketplaceWebhookOutcome(this.deps.metrics, 'unsupported', metricBase);
            throw new MarketplaceWebhookUnsupportedError('Inbound marketplace webhooks are not configured for this provider', {
                marketplaceKey: connection.marketplaceKey,
            });
        }
        const requestContext = {
            headers: input.headers,
            rawBody: input.rawBody,
            connection: {
                tenantId: connection.tenantId,
                channelId: connection.channelId,
                marketplaceKey: connection.marketplaceKey,
                connectionId: connection.connectionId,
            },
        };
        try {
            await adapter.authenticateWebhookRequest(requestContext);
        }
        catch (error) {
            recordMarketplaceWebhookOutcome(this.deps.metrics, 'auth_failed', metricBase);
            if (error instanceof MarketplaceWebhookAuthenticationError) {
                throw error;
            }
            throw new MarketplaceWebhookAuthenticationError(undefined, {
                marketplaceKey: connection.marketplaceKey,
            });
        }
        let normalized;
        try {
            normalized = await adapter.normalizeWebhookEvent(requestContext);
        }
        catch (error) {
            recordMarketplaceWebhookOutcome(this.deps.metrics, 'permanent_failure', metricBase);
            if (error instanceof MarketplaceWebhookPermanentError || error instanceof MarketplaceWebhookUnsupportedError) {
                throw error;
            }
            throw new MarketplaceWebhookPermanentError('Webhook payload could not be normalized', {
                marketplaceKey: connection.marketplaceKey,
            });
        }
        const event = parseOrThrow(normalizedMarketplaceWebhookEventSchema, normalized, 'normalized marketplace webhook event');
        if (event.marketplaceKey !== connection.marketplaceKey) {
            throw new MarketplaceWebhookPermanentError('Webhook event marketplaceKey does not match connection', {
                expected: connection.marketplaceKey,
                received: event.marketplaceKey,
            });
        }
        const idempotencyKey = {
            tenantId: connection.tenantId,
            principalFingerprint: `marketplace-webhook:${connection.connectionId}`,
            routeId: ROUTE_ID,
            idempotencyKey: event.deduplicationKey,
        };
        const fingerprint = fingerprintRequest({
            eventKind: event.eventKind,
            deduplicationKey: event.deduplicationKey,
            marketplaceKey: event.marketplaceKey,
            resourceType: event.resource.type,
        });
        try {
            const idempotent = await this.deps.idempotency.execute(idempotencyKey, fingerprint, async () => {
                const result = await this.deps.orderLifecycleProcessor.process({
                    event,
                    tenantId: connection.tenantId,
                    channelId: connection.channelId,
                    ...(input.correlationId === undefined ? {} : { correlationId: input.correlationId }),
                });
                return {
                    outcome: result.outcome ?? 'processed',
                    externalOrderReference: result.externalOrderReference ?? null,
                };
            }, (value) => ({
                statusCode: 200,
                body: value,
            }), { useTransaction: true });
            if (idempotent.kind === 'replayed') {
                recordMarketplaceWebhookOutcome(this.deps.metrics, 'duplicate', metricBase);
            }
            else {
                recordMarketplaceWebhookOutcome(this.deps.metrics, idempotent.value.outcome === 'duplicate' ? 'duplicate' : 'processed', metricBase);
            }
            this.deps.logger?.info({
                tenantId: connection.tenantId,
                channelId: connection.channelId,
                marketplaceKey: connection.marketplaceKey,
                eventKind: event.eventKind,
                idempotent: idempotent.kind,
            }, 'Marketplace webhook handled');
            return {
                replayed: idempotent.kind === 'replayed',
                data: idempotent.kind === 'replayed' ? idempotent.value : idempotent.value,
            };
        }
        catch (error) {
            if (error instanceof MarketplaceOrderIngestionRetryError || error instanceof MarketplaceOrderLifecycleRetryError) {
                recordMarketplaceWebhookOutcome(this.deps.metrics, 'retryable_failure', metricBase);
                throw new MarketplaceWebhookRetryableError(error.message, {
                    retryAfterSeconds: error.retryDelayMs === null ? null : Math.ceil(error.retryDelayMs / 1_000),
                });
            }
            if (error instanceof MarketplaceOrderIngestionPermanentError) {
                recordMarketplaceWebhookOutcome(this.deps.metrics, 'permanent_failure', metricBase);
                throw new MarketplaceWebhookPermanentError(error.message, error.safeDetails);
            }
            if (error instanceof MarketplaceWebhookPermanentError || error instanceof MarketplaceWebhookUnsupportedError) {
                recordMarketplaceWebhookOutcome(this.deps.metrics, 'permanent_failure', metricBase);
                throw error;
            }
            recordMarketplaceWebhookOutcome(this.deps.metrics, 'retryable_failure', metricBase);
            throw error;
        }
    }
}
