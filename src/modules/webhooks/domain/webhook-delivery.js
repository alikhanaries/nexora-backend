import { WebhookDeliveryStatus } from './webhook-delivery-status.js';

export class WebhookDelivery {
    id;
    tenantId;
    subscriptionId;
    eventId;
    eventType;
    status;
    attemptCount;
    nextAttemptAt;
    lastHttpStatus;
    lastError;
    deliveredAt;
    createdAt;
    constructor(props) {
        this.id = props.id;
        this.tenantId = props.tenantId;
        this.subscriptionId = props.subscriptionId;
        this.eventId = props.eventId;
        this.eventType = props.eventType;
        this.status = props.status;
        this.attemptCount = props.attemptCount;
        this.nextAttemptAt = props.nextAttemptAt;
        this.lastHttpStatus = props.lastHttpStatus;
        this.lastError = props.lastError;
        this.deliveredAt = props.deliveredAt;
        this.createdAt = props.createdAt;
    }
    static createPending(props) {
        return new WebhookDelivery({
            id: props.id,
            tenantId: props.tenantId,
            subscriptionId: props.subscriptionId,
            eventId: props.eventId,
            eventType: props.eventType,
            status: WebhookDeliveryStatus.PENDING,
            attemptCount: 0,
            nextAttemptAt: props.nextAttemptAt ?? null,
            lastHttpStatus: null,
            lastError: null,
            deliveredAt: null,
            createdAt: props.createdAt,
        });
    }
    static reconstitute(props) {
        return new WebhookDelivery(props);
    }
}
