import type { Transaction } from '../persistence/index.js';
import type { NewIntegrationEvent } from './integration-event.js';

/**
 * Records integration events for later publication.
 *
 * Implementations MUST write to the outbox using the caller's transaction so
 * the event and the business change commit atomically. Publishing to the queue
 * happens after commit, in a separate process.
 */
export interface EventRecorder {
  record(transaction: Transaction, event: NewIntegrationEvent): Promise<void>;
  recordMany(transaction: Transaction, events: readonly NewIntegrationEvent[]): Promise<void>;
}

/** Shape of an event as it arrives at a consumer. */
export interface ReceivedIntegrationEvent {
  readonly id: string;
  readonly type: string;
  readonly version: number;
  readonly aggregateType: string;
  readonly aggregateId: string;
  readonly tenantId: string | null;
  readonly payload: Readonly<Record<string, unknown>>;
  readonly occurredAt: Date;
  readonly correlationId: string | null;
}

/**
 * Handles one inbound integration event.
 *
 * Handlers must be idempotent: delivery is at-least-once, so the same event
 * can arrive more than once. The inbox provides the deduplication primitive.
 */
export interface IntegrationEventHandler {
  /** Stable name identifying this consumer in the inbox. */
  readonly consumerName: string;
  handle(event: ReceivedIntegrationEvent): Promise<void>;
}

/**
 * Deduplication store for inbound events.
 *
 * `beginProcessing` reserves (consumer, eventId). A `false` result means this
 * consumer already handled the event and the delivery must be dropped.
 */
export interface InboxStore {
  beginProcessing(
    transaction: Transaction,
    consumerName: string,
    eventId: string,
    eventType: string,
  ): Promise<boolean>;
  markProcessed(transaction: Transaction, consumerName: string, eventId: string): Promise<void>;
  markFailed(
    transaction: Transaction,
    consumerName: string,
    eventId: string,
    error: string,
  ): Promise<void>;
  purgeProcessedBefore(cutoff: Date, batchSize: number): Promise<number>;
}
