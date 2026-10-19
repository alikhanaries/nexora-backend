import { WASL_NAMING } from '../../shared/config/wasl-naming.config.js';

const { logicalNames, jobNames } = WASL_NAMING.infrastructure.queue;

/**
 * Every queue in the system, declared in one place.
 *
 * Queue names are metric labels and Redis key components, so they must be a
 * closed set of constants rather than ad-hoc strings.
 */
export const QueueName = {
    /** Integration events handed over by the outbox publisher. */
    INTEGRATION_EVENTS: logicalNames.integrationEvents,
    /** Webhook HTTP delivery jobs enqueued by the dispatch handler. */
    WEBHOOK_DELIVERIES: logicalNames.webhookDeliveries,
    /** Outbound integration catalog synchronization jobs (persisted BullMQ name). */
    CHANNEL_CATALOG_SYNC: logicalNames.catalogSync,
    /** Inbound/outbound marketplace order lifecycle jobs (webhook, polling, outbound). */
    MARKETPLACE_ORDER_LIFECYCLE: logicalNames.marketplaceOrderLifecycle,
};
/** Job names within {@link QueueName.INTEGRATION_EVENTS}. */
export const JobName = {
    PUBLISH_INTEGRATION_EVENT: jobNames.publishIntegrationEvent,
    DELIVER_WEBHOOK: jobNames.deliverWebhook,
    RUN_CATALOG_SYNC: jobNames.runCatalogSync,
    PROCESS_MARKETPLACE_LIFECYCLE: jobNames.processMarketplaceLifecycle,
};
