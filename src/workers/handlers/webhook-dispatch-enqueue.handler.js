/**
 * Enqueues webhook delivery jobs for tenant subscriptions matching an
 * externally deliverable integration event. Never performs HTTP or decrypts secrets.
 */
export class WebhookDispatchEnqueueHandler {
    webhookDispatchService;
    consumerName = 'webhooks.dispatch-enqueue';
    constructor(webhookDispatchService) {
        this.webhookDispatchService = webhookDispatchService;
    }
    async handle(event) {
        await this.webhookDispatchService.dispatch(event);
    }
}
