import { recordWebhookDeliveryOutcome } from '../../../shared/metrics/record-webhook-delivery.js';
import { WebhookDeliveryStatus } from '../domain/webhook-delivery-status.js';
import { WebhookSubscriptionStatus } from '../domain/webhook-subscription-status.js';
import { buildWebhookEventEnvelope } from './build-webhook-event-envelope.js';
import { classifyWebhookHttpResponse, parseRetryAfterSeconds } from './classify-webhook-http-response.js';
import { sanitizeWebhookDeliveryError, WebhookDeliveryRetryError } from './webhook-delivery-errors.js';
import { resolveWebhookRetryDelayMs } from './webhook-delivery-retry-delay.js';
import {
    signWebhookRequestBody,
    WEBHOOK_DELIVERY_ID_HEADER,
    WEBHOOK_EVENT_HEADER,
    WEBHOOK_EVENT_ID_HEADER,
    WEBHOOK_SIGNATURE_HEADER,
} from './webhook-request-signer.js';

export class WebhookDeliveryService {
    deps;
    constructor(deps) {
        this.deps = deps;
    }
    /**
     * @param {object} job
     * @param {string} job.tenantId
     * @param {string} job.deliveryId
     * @param {string} job.subscriptionId
     * @param {string} job.eventId
     * @param {string} job.eventType
     * @param {import('../../../infrastructure/queue/bullmq-worker-runtime.js').JobContext} context
     */
    async deliver(job, context) {
        const startedAt = Date.now();
        this.deps.logger.info({
            tenantId: job.tenantId,
            deliveryId: job.deliveryId,
            subscriptionId: job.subscriptionId,
            eventId: job.eventId,
            eventType: job.eventType,
            attempt: context.attempt,
            maxAttempts: context.maxAttempts,
        }, 'Webhook delivery started');
        recordWebhookDeliveryOutcome(this.deps.metrics, 'attempt');
        const preparation = await this.prepareDelivery(job);
        if (preparation.kind !== 'ready') {
            if (preparation.kind === 'subscription_inactive') {
                recordWebhookDeliveryOutcome(this.deps.metrics, 'dead_lettered');
            }
            this.logSkipped(preparation, job);
            return;
        }
        const { delivery, subscription } = preparation;
        const event = await this.deps.outbox.findByIdForTenant(job.tenantId, job.eventId);
        if (event === null || event.type !== job.eventType) {
            await this.persistTerminalFailure(job.tenantId, delivery, {
                status: WebhookDeliveryStatus.DEAD_LETTERED,
                lastError: 'Integration event payload not found',
                lastHttpStatus: null,
            });
            recordWebhookDeliveryOutcome(this.deps.metrics, 'dead_lettered');
            this.deps.logger.warn({
                tenantId: job.tenantId,
                deliveryId: job.deliveryId,
                eventId: job.eventId,
            }, 'Webhook delivery dead-lettered because event payload is missing');
            return;
        }
        try {
            await this.deps.ssrfValidator(subscription.url);
        }
        catch (error) {
            await this.persistTerminalFailure(job.tenantId, delivery, {
                status: WebhookDeliveryStatus.DEAD_LETTERED,
                lastError: sanitizeWebhookDeliveryError(error),
                lastHttpStatus: null,
            });
            recordWebhookDeliveryOutcome(this.deps.metrics, 'dead_lettered');
            this.deps.logger.warn({
                tenantId: job.tenantId,
                deliveryId: job.deliveryId,
                reason: sanitizeWebhookDeliveryError(error),
            }, 'Webhook delivery dead-lettered because URL failed SSRF validation');
            return;
        }
        let secret;
        try {
            secret = this.deps.secretEncryptor.decrypt(subscription.secretCiphertext);
        }
        catch {
            await this.persistTerminalFailure(job.tenantId, delivery, {
                status: WebhookDeliveryStatus.DEAD_LETTERED,
                lastError: 'Webhook secret decryption failed',
                lastHttpStatus: null,
            });
            recordWebhookDeliveryOutcome(this.deps.metrics, 'dead_lettered');
            this.deps.logger.error({
                tenantId: job.tenantId,
                deliveryId: job.deliveryId,
                subscriptionId: job.subscriptionId,
            }, 'Webhook delivery dead-lettered because secret decryption failed');
            return;
        }
        const body = buildWebhookEventEnvelope(event);
        const signature = signWebhookRequestBody(secret, body);
        secret = '';
        try {
            const response = await this.deps.httpClient.send({
                operation: 'webhooks.deliver',
                method: 'POST',
                url: subscription.url,
                headers: {
                    'content-type': 'application/json; charset=utf-8',
                    [WEBHOOK_EVENT_HEADER]: event.type,
                    [WEBHOOK_EVENT_ID_HEADER]: event.id,
                    [WEBHOOK_DELIVERY_ID_HEADER]: delivery.id,
                    [WEBHOOK_SIGNATURE_HEADER]: signature,
                },
                body,
                timeoutMs: this.deps.config.timeoutMs,
                returnErrorResponses: true,
                redirect: 'manual',
            });
            const classification = classifyWebhookHttpResponse(response.status);
            if (classification.outcome === 'success') {
                await this.persistSuccess(job.tenantId, delivery, response.status);
                recordWebhookDeliveryOutcome(this.deps.metrics, 'success', Date.now() - startedAt);
                this.deps.logger.info({
                    tenantId: job.tenantId,
                    deliveryId: job.deliveryId,
                    subscriptionId: job.subscriptionId,
                    eventId: job.eventId,
                    eventType: job.eventType,
                    attemptCount: delivery.attemptCount,
                    httpStatus: response.status,
                    durationMs: Date.now() - startedAt,
                }, 'Webhook delivery succeeded');
                return;
            }
            const retryAfterSeconds = parseRetryAfterSeconds(response.headers);
            const lastError = retryAfterSeconds === null
                ? `Upstream returned HTTP ${response.status}`
                : `Upstream returned HTTP ${response.status}; Retry-After=${retryAfterSeconds}s`;
            if (classification.retryable) {
                await this.handleRetryableFailure(job, delivery, context, {
                    lastHttpStatus: response.status,
                    lastError,
                    retryAfterSeconds,
                });
                return;
            }
            await this.persistTerminalFailure(job.tenantId, delivery, {
                status: WebhookDeliveryStatus.DEAD_LETTERED,
                lastError,
                lastHttpStatus: response.status,
            });
            recordWebhookDeliveryOutcome(this.deps.metrics, 'dead_lettered');
            this.deps.logger.warn({
                tenantId: job.tenantId,
                deliveryId: job.deliveryId,
                httpStatus: response.status,
                attemptCount: delivery.attemptCount,
            }, 'Webhook delivery dead-lettered after permanent HTTP failure');
        }
        catch (error) {
            if (error instanceof WebhookDeliveryRetryError) {
                throw error;
            }
            await this.handleRetryableFailure(job, delivery, context, {
                lastHttpStatus: null,
                lastError: sanitizeWebhookDeliveryError(error),
            });
        }
    }
    async prepareDelivery(job) {
        return this.deps.database.execute(async (tx) => {
            const delivery = await this.deps.deliveries.findById(tx, job.tenantId, job.deliveryId);
            if (delivery === null) {
                return { kind: 'missing_delivery' };
            }
            if (delivery.status === WebhookDeliveryStatus.DELIVERED) {
                return { kind: 'already_delivered' };
            }
            if (delivery.status === WebhookDeliveryStatus.DEAD_LETTERED) {
                return { kind: 'terminal' };
            }
            if (delivery.subscriptionId !== job.subscriptionId
                || delivery.eventId !== job.eventId
                || delivery.eventType !== job.eventType) {
                return { kind: 'job_mismatch' };
            }
            const subscription = await this.deps.subscriptions.findById(tx, job.tenantId, job.subscriptionId);
            if (subscription === null || subscription.status !== WebhookSubscriptionStatus.ACTIVE) {
                if (delivery.status !== WebhookDeliveryStatus.DELIVERED
                    && delivery.status !== WebhookDeliveryStatus.DEAD_LETTERED) {
                    await this.persistTerminalFailureInTx(tx, delivery, {
                        status: WebhookDeliveryStatus.DEAD_LETTERED,
                        lastError: 'Webhook subscription is not active',
                        lastHttpStatus: null,
                    }, [WebhookDeliveryStatus.PENDING, WebhookDeliveryStatus.FAILED]);
                }
                return { kind: 'subscription_inactive' };
            }
            const claimed = await this.deps.deliveries.claimAttempt(tx, job.tenantId, job.deliveryId, this.deps.config.leaseSeconds);
            if (claimed === null) {
                return { kind: 'already_in_progress' };
            }
            return { kind: 'ready', delivery: claimed, subscription };
        }, { tenantId: job.tenantId });
    }
    async handleRetryableFailure(job, delivery, context, failure) {
        const exhausted = context.attempt >= context.maxAttempts;
        const retryDelayMs = resolveWebhookRetryDelayMs(failure.retryAfterSeconds ?? null, this.deps.config.maxRetryAfterSeconds);
        const nextAttemptAt = retryDelayMs === null ? null : new Date(Date.now() + retryDelayMs);
        await this.deps.database.execute(async (tx) => {
            await this.persistTerminalFailureInTx(tx, delivery, {
                status: exhausted ? WebhookDeliveryStatus.DEAD_LETTERED : WebhookDeliveryStatus.FAILED,
                lastError: failure.lastError,
                lastHttpStatus: failure.lastHttpStatus,
                nextAttemptAt: exhausted ? null : nextAttemptAt,
            }, [WebhookDeliveryStatus.DELIVERING]);
        }, { tenantId: job.tenantId });
        if (exhausted) {
            recordWebhookDeliveryOutcome(this.deps.metrics, 'dead_lettered');
            this.deps.logger.warn({
                tenantId: job.tenantId,
                deliveryId: job.deliveryId,
                subscriptionId: job.subscriptionId,
                eventId: job.eventId,
                attemptCount: delivery.attemptCount,
                httpStatus: failure.lastHttpStatus,
            }, 'Webhook delivery dead-lettered after retry exhaustion');
            return;
        }
        recordWebhookDeliveryOutcome(this.deps.metrics, 'retryable_failure');
        this.deps.logger.warn({
            tenantId: job.tenantId,
            deliveryId: job.deliveryId,
            subscriptionId: job.subscriptionId,
            eventId: job.eventId,
            attemptCount: delivery.attemptCount,
            httpStatus: failure.lastHttpStatus,
            attempt: context.attempt,
            maxAttempts: context.maxAttempts,
        }, 'Webhook delivery failed and will be retried');
        throw new WebhookDeliveryRetryError(failure.lastError, {
            retryDelayMs: retryDelayMs ?? undefined,
        });
    }
    async persistSuccess(tenantId, delivery, httpStatus) {
        const applied = await this.deps.database.execute(async (tx) => this.deps.deliveries.update(tx, {
            ...delivery,
            status: WebhookDeliveryStatus.DELIVERED,
            nextAttemptAt: null,
            lastHttpStatus: httpStatus,
            lastError: null,
            deliveredAt: new Date(),
        }, { expectedStatuses: [WebhookDeliveryStatus.DELIVERING] }), { tenantId });
        if (!applied) {
            this.deps.logger.debug({
                tenantId,
                deliveryId: delivery.id,
            }, 'Webhook delivery result ignored because the row is no longer DELIVERING');
        }
    }
    async persistTerminalFailure(tenantId, delivery, outcome) {
        await this.deps.database.execute(async (tx) => {
            await this.persistTerminalFailureInTx(tx, delivery, outcome, [WebhookDeliveryStatus.DELIVERING]);
        }, { tenantId });
    }
    async persistTerminalFailureInTx(tx, delivery, outcome, expectedStatuses) {
        const statuses = expectedStatuses ?? [
            WebhookDeliveryStatus.PENDING,
            WebhookDeliveryStatus.FAILED,
            WebhookDeliveryStatus.DELIVERING,
        ];
        await this.deps.deliveries.update(tx, {
            ...delivery,
            status: outcome.status,
            nextAttemptAt: outcome.nextAttemptAt ?? null,
            lastHttpStatus: outcome.lastHttpStatus,
            lastError: outcome.lastError,
            deliveredAt: null,
        }, { expectedStatuses: statuses });
    }
    logSkipped(preparation, job) {
        if (preparation.kind === 'already_delivered' || preparation.kind === 'terminal') {
            this.deps.logger.debug({
                tenantId: job.tenantId,
                deliveryId: job.deliveryId,
                reason: preparation.kind,
            }, 'Webhook delivery skipped');
            return;
        }
        if (preparation.kind === 'subscription_inactive') {
            this.deps.logger.info({
                tenantId: job.tenantId,
                deliveryId: job.deliveryId,
                subscriptionId: job.subscriptionId,
            }, 'Webhook delivery skipped because subscription is inactive');
            return;
        }
        this.deps.logger.debug({
            tenantId: job.tenantId,
            deliveryId: job.deliveryId,
            reason: preparation.kind,
        }, 'Webhook delivery skipped');
    }
}
