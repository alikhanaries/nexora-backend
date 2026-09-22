/**
 * Every queue in the system, declared in one place.
 *
 * Queue names are metric labels and Redis key components, so they must be a
 * closed set of constants rather than ad-hoc strings.
 */
export const QueueName = {
    /** Integration events handed over by the outbox publisher. */
    INTEGRATION_EVENTS: 'integration-events',
    /** Webhook HTTP delivery jobs enqueued by the dispatch handler. */
    WEBHOOK_DELIVERIES: 'webhook-deliveries',
};
/** Job names within {@link QueueName.INTEGRATION_EVENTS}. */
export const JobName = {
    PUBLISH_INTEGRATION_EVENT: 'publish-integration-event',
    /** Hand off a persisted webhook delivery row to the future HTTP worker. */
    DELIVER_WEBHOOK: 'deliver-webhook',
};
