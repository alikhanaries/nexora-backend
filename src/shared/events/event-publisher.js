/**
 * Reserved for a future publish-side abstraction if domain code needs to emit
 * events outside the transactional outbox path.
 *
 * Phase 6 uses {@link EventRecorderPort} for all domain producers. External
 * webhook HTTP delivery is handled asynchronously by worker handlers.
 */

export {};
