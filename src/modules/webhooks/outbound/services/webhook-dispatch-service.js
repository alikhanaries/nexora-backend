import { randomUUID } from 'node:crypto';
import { isExternallyDeliverable } from '../../../../shared/events/index.js';
import { ConflictError, ServiceUnavailableError } from '../../../../shared/errors/index.js';
import { JobName, QueueName } from '../../../../infrastructure/queue/queue-names.js';
import { createPendingWebhookDelivery } from '../models/webhook-delivery.js';
const DELIVERY_UNIQUE_CONSTRAINT = 'webhook_deliveries_subscription_event_unique';

export function createWebhookDispatchService(deps) {
    async function dispatch(event) {
        if (!isExternallyDeliverable(event.type)) {
            return { deliveriesEnsured: 0, jobsEnqueued: 0 };
        }
        if (event.tenantId === null) {
            return { deliveriesEnsured: 0, jobsEnqueued: 0 };
        }
        /** @type {Array<{ tenantId: string, deliveryId: string, subscriptionId: string, eventId: string, eventType: string }>} */
        const enqueueTargets = [];
        await deps.database.execute(async (tx) => {
            const subscriptions = await deps.subscriptions.listActiveForEventType(tx, event.tenantId, event.type);
            for (const subscription of subscriptions) {
                const delivery = await ensurePendingDelivery(tx, event, subscription.id);
                enqueueTargets.push({
                    tenantId: event.tenantId,
                    deliveryId: delivery.id,
                    subscriptionId: subscription.id,
                    eventId: event.id,
                    eventType: event.type,
                });
            }
        }, { tenantId: event.tenantId });
        let jobsEnqueued = 0;
        for (const target of enqueueTargets) {
            const enqueued = await enqueueDeliveryJob(target);
            if (enqueued) {
                jobsEnqueued += 1;
            }
        }
        return {
            deliveriesEnsured: enqueueTargets.length,
            jobsEnqueued,
        };
    }
    async function ensurePendingDelivery(tx, event, subscriptionId) {
        const existing = await deps.deliveries.findBySubscriptionAndEventId(tx, event.tenantId, subscriptionId, event.id);
        if (existing !== null) {
            return existing;
        }
        const delivery = createPendingWebhookDelivery({
            id: randomUUID(),
            tenantId: event.tenantId,
            subscriptionId,
            eventId: event.id,
            eventType: event.type,
            createdAt: new Date(),
        });
        try {
            await deps.deliveries.insert(tx, delivery);
            return delivery;
        }
        catch (error) {
            if (error instanceof ConflictError && error.safeDetails?.constraint === DELIVERY_UNIQUE_CONSTRAINT) {
                const raced = await deps.deliveries.findBySubscriptionAndEventId(tx, event.tenantId, subscriptionId, event.id);
                if (raced !== null) {
                    return raced;
                }
            }
            throw error;
        }
    }
    function buildDeliveryJobId(subscriptionId, eventId) {
        return `${subscriptionId}_${eventId}`;
    }
    async function enqueueDeliveryJob(target) {
        const jobId = buildDeliveryJobId(target.subscriptionId, target.eventId);
        try {
            await deps.queue.enqueue(QueueName.WEBHOOK_DELIVERIES, JobName.DELIVER_WEBHOOK, {
                tenantId: target.tenantId,
                deliveryId: target.deliveryId,
                subscriptionId: target.subscriptionId,
                eventId: target.eventId,
                eventType: target.eventType,
            }, { jobId });
            return true;
        }
        catch (error) {
            if (isDuplicateQueueJobError(error)) {
                return false;
            }
            throw error;
        }
    }
    function isDuplicateQueueJobError(error) {
        if (!(error instanceof ServiceUnavailableError)) {
            return false;
        }
        const reason = error.safeDetails?.reason;
        return typeof reason === 'string' && reason.toLowerCase().includes('already exists');
    }
    return { dispatch };
}
