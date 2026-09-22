import { BusinessRuleError } from '../../../shared/errors/index.js';
import { WebhookSubscriptionStatus } from './webhook-subscription-status.js';

export class WebhookSubscription {
    id;
    tenantId;
    url;
    description;
    secretCiphertext;
    eventTypes;
    status;
    createdBy;
    createdAt;
    updatedAt;
    constructor(props) {
        this.id = props.id;
        this.tenantId = props.tenantId;
        this.url = props.url;
        this.description = props.description;
        this.secretCiphertext = props.secretCiphertext;
        this.eventTypes = props.eventTypes;
        this.status = props.status;
        this.createdBy = props.createdBy;
        this.createdAt = props.createdAt;
        this.updatedAt = props.updatedAt;
    }
    static create(props) {
        return new WebhookSubscription({
            id: props.id,
            tenantId: props.tenantId,
            url: props.url,
            description: props.description ?? null,
            secretCiphertext: props.secretCiphertext,
            eventTypes: [...props.eventTypes],
            status: WebhookSubscriptionStatus.ACTIVE,
            createdBy: props.createdBy ?? null,
            createdAt: props.createdAt,
            updatedAt: props.createdAt,
        });
    }
    static reconstitute(props) {
        return new WebhookSubscription({
            ...props,
            eventTypes: [...props.eventTypes],
        });
    }
    isActive() {
        return this.status === WebhookSubscriptionStatus.ACTIVE;
    }
    updateDetails(input, at) {
        if (this.status === WebhookSubscriptionStatus.DELETED) {
            throw new BusinessRuleError('Deleted webhook subscriptions cannot be updated');
        }
        return new WebhookSubscription({
            id: this.id,
            tenantId: this.tenantId,
            url: input.url ?? this.url,
            description: input.description === undefined ? this.description : input.description,
            secretCiphertext: this.secretCiphertext,
            eventTypes: input.eventTypes === undefined ? this.eventTypes : [...input.eventTypes],
            status: input.status ?? this.status,
            createdBy: this.createdBy,
            createdAt: this.createdAt,
            updatedAt: at,
        });
    }
    disable(at) {
        if (this.status === WebhookSubscriptionStatus.DELETED) {
            throw new BusinessRuleError('Deleted webhook subscriptions cannot be disabled');
        }
        return new WebhookSubscription({
            ...this,
            eventTypes: [...this.eventTypes],
            status: WebhookSubscriptionStatus.DISABLED,
            updatedAt: at,
        });
    }
    delete(at) {
        return new WebhookSubscription({
            ...this,
            eventTypes: [...this.eventTypes],
            status: WebhookSubscriptionStatus.DELETED,
            updatedAt: at,
        });
    }
    rotateSecret(secretCiphertext, at) {
        if (this.status === WebhookSubscriptionStatus.DELETED) {
            throw new BusinessRuleError('Deleted webhook subscriptions cannot rotate secrets');
        }
        return new WebhookSubscription({
            ...this,
            eventTypes: [...this.eventTypes],
            secretCiphertext,
            updatedAt: at,
        });
    }
}
