import { randomUUID } from 'node:crypto';
import { isExternallyDeliverable } from '../../../shared/events/index.js';
import { ConflictError, ServiceUnavailableError } from '../../../shared/errors/index.js';
import { JobName, QueueName } from '../../../infrastructure/queue/queue-names.js';
import { WebhookDelivery } from '../domain/webhook-delivery.js';
const DELIVERY_UNIQUE_CONSTRAINT = 'webhook_deliveries_subscription_event_unique';

export class WebhookDispatchService {
    deps;
    constructor(deps) {
        this.deps = deps;
    }
    async dispatch(event) {
        if (!isExternallyDeliverable(event.type)) {
            return { deliveriesEnsured: 0, jobsEnqueued: 0 };
        }
        if (event.tenantId === null) {
            return { deliveriesEnsured: 0, jobsEnqueued: 0 };
        }
        /** @type {Array<{ tenantId: string, deliveryId: string, subscriptionId: string, eventId: string, eventType: string }>} */
        const enqueueTargets = [];
        await this.deps.database.execute(async (tx) => {
            const subscriptions = await this.deps.subscriptions.listActiveForEventType(tx, event.tenantId, event.type);
            for (const subscription of subscriptions) {
                const delivery = await this.ensurePendingDelivery(tx, event, subscription.id);
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
            const enqueued = await this.enqueueDeliveryJob(target);
            if (enqueued) {
                jobsEnqueued += 1;
            }
        }
        return {
            deliveriesEnsured: enqueueTargets.length,
            jobsEnqueued,
        };
    }
    async ensurePendingDelivery(tx, event, subscriptionId) {
        const existing = await this.deps.deliveries.findBySubscriptionAndEventId(tx, event.tenantId, subscriptionId, event.id);
        if (existing !== null) {
            return existing;
        }
        const delivery = WebhookDelivery.createPending({
            id: randomUUID(),
            tenantId: event.tenantId,
            subscriptionId,
            eventId: event.id,
            eventType: event.type,
            createdAt: new Date(),
        });
        try {
            await this.deps.deliveries.insert(tx, delivery);
            return delivery;
        }
        catch (error) {
            if (error instanceof ConflictError && error.safeDetails?.constraint === DELIVERY_UNIQUE_CONSTRAINT) {
                const raced = await this.deps.deliveries.findBySubscriptionAndEventId(tx, event.tenantId, subscriptionId, event.id);
                if (raced !== null) {
                    return raced;
                }
            }
            throw error;
        }
    }
    buildDeliveryJobId(subscriptionId, eventId) {
        return `${subscriptionId}_${eventId}`;
    }
    async enqueueDeliveryJob(target) {
        const jobId = this.buildDeliveryJobId(target.subscriptionId, target.eventId);
        try {
            await this.deps.queue.enqueue(QueueName.WEBHOOK_DELIVERIES, JobName.DELIVER_WEBHOOK, {
                tenantId: target.tenantId,
                deliveryId: target.deliveryId,
                subscriptionId: target.subscriptionId,
                eventId: target.eventId,
                eventType: target.eventType,
            }, { jobId });
            return true;
        }
        catch (error) {
            if (this.isDuplicateQueueJobError(error)) {
                return false;
            }
            throw error;
        }
    }
    isDuplicateQueueJobError(error) {
        if (!(error instanceof ServiceUnavailableError)) {
            return false;
        }
        const reason = error.safeDetails?.reason;
        return typeof reason === 'string' && reason.toLowerCase().includes('already exists');
    }
}
