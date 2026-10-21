/**
 * Enqueues webhook delivery jobs for tenant subscriptions matching an
 * externally deliverable integration event. Never performs HTTP or decrypts secrets.
 */
export class WebhookDispatchEnqueueHandler {
    webhookDispatchService;
    consumerName = 'webhooks.dispatch-enqueue';
    /** @param {import('../../modules/webhooks/outbound/services/webhook-dispatch-service.js').WebhookDispatchService} webhookDispatchService */
    constructor(webhookDispatchService) {
        this.webhookDispatchService = webhookDispatchService;
    }
    /** Enqueues webhook delivery jobs for matching tenant subscriptions. */
    async handle(event) {
        await this.webhookDispatchService.dispatch(event);
    }
}
