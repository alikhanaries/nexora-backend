/**
 * Canonical Wasl naming — single source of truth for internal identifiers and
 * documented external/persisted compatibility values.
 *
 * Lives under `shared/config` so infrastructure and application layers can import
 * without violating architecture boundaries (infrastructure must not depend on `app/`).
 */

/** @typedef {'external-http'|'external-webhook'|'persisted-db'|'persisted-queue'|'persisted-cache'|'persisted-payload'|'observability-legacy'|'historical-adr'} CompatibilityKind */

/**
 * Values that must remain stable until an explicit migration ships.
 * The naming verifier allowlists these exact strings in context.
 *
 * @type {ReadonlyArray<{ id: string, kind: CompatibilityKind, value: string, migrationOwner: string, migrationPlan: string }>}
 */
export const WASL_EXTERNAL_COMPATIBILITY = Object.freeze([
  {
    id: 'http.routes.channels.v1',
    kind: 'external-http',
    value: '/api/v1/channels',
    migrationOwner: 'api-platform',
    migrationPlan: 'Keep until API v2 tenant integration routes replace v1 with deprecation window.',
  },
  {
    id: 'http.routes.compat-v2-ce',
    kind: 'external-http',
    value: '/api/v2/ce/',
    migrationOwner: 'stockconnect-integration',
    migrationPlan: 'StockConnect CE surface; rename only with coordinated StockConnect release.',
  },
  {
    id: 'http.json.channelId',
    kind: 'external-http',
    value: 'channelId',
    migrationOwner: 'api-platform',
    migrationPlan: 'Public JSON field; add integrationId alias before removal.',
  },
  {
    id: 'http.json.integrationEntityType',
    kind: 'external-http',
    value: 'integrationEntityType',
    migrationOwner: 'api-platform',
    migrationPlan: 'Canonical integration entity fields in public JSON.',
  },
  {
    id: 'http.json.integrationEntityId',
    kind: 'external-http',
    value: 'integrationEntityId',
    migrationOwner: 'api-platform',
    migrationPlan: 'Add integrationEntityId; DB column rename is separate migration.',
  },
  {
    id: 'webhook.header.signature',
    kind: 'external-webhook',
    value: 'X-Wasl-Signature',
    migrationOwner: 'webhooks',
    migrationPlan: 'Outbound webhook HMAC header.',
  },
  {
    id: 'webhook.header.event',
    kind: 'external-webhook',
    value: 'X-Wasl-Event',
    migrationOwner: 'webhooks',
    migrationPlan: 'Outbound webhook event type header.',
  },
  {
    id: 'webhook.header.eventId',
    kind: 'external-webhook',
    value: 'X-Wasl-Event-Id',
    migrationOwner: 'webhooks',
    migrationPlan: 'Outbound webhook event id header.',
  },
  {
    id: 'webhook.header.deliveryId',
    kind: 'external-webhook',
    value: 'X-Wasl-Delivery-Id',
    migrationOwner: 'webhooks',
    migrationPlan: 'Paired with signature migration.',
  },
  {
    id: 'webhook.subscription.stockconnect-bridge',
    kind: 'persisted-payload',
    value: 'stockconnect-ce-bridge',
    migrationOwner: 'stockconnect-integration',
    migrationPlan: 'Subscription description match; changing breaks existing webhook routing.',
  },
  {
    id: 'idempotency.compat-v2-prefix',
    kind: 'persisted-payload',
    value: 'ce-compat:',
    migrationOwner: 'stockconnect-integration',
    migrationPlan: 'Idempotency store keys; migrate with dual-read window.',
  },
  {
    id: 'invoice.compat-v2-number',
    kind: 'external-http',
    value: 'CE-',
    migrationOwner: 'stockconnect-integration',
    migrationPlan: 'Invoice PDF prefix for StockConnect ParseInvoice flows.',
  },
  {
    id: 'db.table.channels',
    kind: 'persisted-db',
    value: 'channels',
    migrationOwner: 'data-platform',
    migrationPlan: 'Forward migration rename to commerce_integrations + view alias.',
  },
  {
    id: 'db.column.channel_id',
    kind: 'persisted-db',
    value: 'channel_id',
    migrationOwner: 'data-platform',
    migrationPlan: 'Rename with table migration; FK updates required.',
  },
  {
    id: 'db.column.wasl_entity_type',
    kind: 'persisted-db',
    value: 'wasl_entity_type',
    migrationOwner: 'data-platform',
    migrationPlan: 'Add platform_entity_type column + backfill + dual-write before drop.',
  },
  {
    id: 'db.column.wasl_entity_id',
    kind: 'persisted-db',
    value: 'wasl_entity_id',
    migrationOwner: 'data-platform',
    migrationPlan: 'Paired with wasl_entity_type migration.',
  },
  {
    id: 'db.role.wasl_app',
    kind: 'persisted-db',
    value: 'wasl_app',
    migrationOwner: 'data-platform',
    migrationPlan: 'PostgreSQL RLS runtime role from migration 0030; rename only via new role + GRANT migration.',
  },
  {
    id: 'queue.logical.catalog-sync',
    kind: 'persisted-queue',
    value: 'channel-catalog-sync',
    migrationOwner: 'workers',
    migrationPlan: 'BullMQ logical name; migrate with drain + dual consumer on integration-catalog-sync.',
  },
  {
    id: 'queue.consumer.catalog-sync-enqueue',
    kind: 'persisted-queue',
    value: 'channel-catalog-sync.enqueue',
    migrationOwner: 'workers',
    migrationPlan: 'Inbox consumer name tied to queue migration.',
  },
]);

const application = Object.freeze({
  id: 'wasl',
  displayName: 'Wasl',
  backendServiceId: 'wasl-backend',
  packageName: 'wasl-backend',
  postgresApplicationName: 'wasl-backend',
  postgresOwnerApplicationName: 'wasl-backend-owner',
  postgresMigrateApplicationName: 'wasl-backend-migrate',
});

const infrastructure = Object.freeze({
  redis: Object.freeze({
    defaultKeyPrefix: 'wasl',
    defaultInstanceNamespace: 'local',
  }),
  queue: Object.freeze({
    defaultPrefix: 'wasl-queue',
    logicalNames: Object.freeze({
      integrationEvents: 'integration-events',
      webhookDeliveries: 'webhook-deliveries',
      /** Persisted BullMQ name — see WASL_EXTERNAL_COMPATIBILITY queue.logical.catalog-sync */
      catalogSync: 'channel-catalog-sync',
      marketplaceOrderLifecycle: 'marketplace-order-lifecycle',
    }),
    jobNames: Object.freeze({
      publishIntegrationEvent: 'publish-integration-event',
      deliverWebhook: 'deliver-webhook',
      runCatalogSync: 'run-catalog-sync',
      processMarketplaceLifecycle: 'process-marketplace-lifecycle',
    }),
    inboxConsumers: Object.freeze({
      catalogSyncEnqueue: 'channel-catalog-sync.enqueue',
    }),
  }),
  storage: Object.freeze({
    defaultLocalBucket: 'wasl-local',
  }),
});

const integrations = Object.freeze({
  foundationStubMarketplaceKey: 'wasl-foundation-stub',
  stockConnectIntegrationRoutePrefix: '/api/v2/stock-connect',
});

const observability = Object.freeze({
  defaultOtelServiceName: 'wasl-backend',
  metrics: Object.freeze({
    retentionCleanupDeletedTotal: 'wasl_retention_cleanup_deleted_total',
    retentionCleanupRunsTotal: 'wasl_retention_cleanup_runs_total',
    retentionCleanupFailuresTotal: 'wasl_retention_cleanup_failures_total',
    retentionCleanupDurationSeconds: 'wasl_retention_cleanup_duration_seconds',
  }),
});

const security = Object.freeze({
  webhookSignatureVersion: 'v1',
});

/**
 * Structured Wasl naming configuration.
 * Flat legacy keys on WASL_NAMING remain for backward-compatible imports.
 */
export const WASL_NAMING = Object.freeze({
  application,
  infrastructure,
  integrations,
  observability,
  security,
  externalCompatibility: WASL_EXTERNAL_COMPATIBILITY,

  applicationId: application.id,
  applicationDisplayName: application.displayName,
  backendServiceId: application.backendServiceId,
  defaultRedisKeyPrefix: infrastructure.redis.defaultKeyPrefix,
  defaultQueuePrefix: infrastructure.queue.defaultPrefix,
  defaultOtelServiceName: observability.defaultOtelServiceName,
  defaultInstanceNamespace: infrastructure.redis.defaultInstanceNamespace,
});

/** @param {typeof WASL_NAMING} naming */
export function validateWaslNaming(naming) {
  const problems = [];
  if (naming.application.backendServiceId.trim().length === 0) {
    problems.push('application.backendServiceId is required');
  }
  if (naming.application.id.trim().length === 0) {
    problems.push('application.id is required');
  }
  if (naming.infrastructure.queue.logicalNames.catalogSync !== 'channel-catalog-sync') {
    problems.push('catalog sync queue logical name must stay channel-catalog-sync until queue migration');
  }
  if (naming.infrastructure.queue.inboxConsumers.catalogSyncEnqueue !== 'channel-catalog-sync.enqueue') {
    problems.push('catalog sync enqueue consumer must stay channel-catalog-sync.enqueue until queue migration');
  }
  return problems;
}

/** @param {string} id */
export function getExternalCompatibilityEntry(id) {
  return WASL_EXTERNAL_COMPATIBILITY.find((entry) => entry.id === id) ?? null;
}
