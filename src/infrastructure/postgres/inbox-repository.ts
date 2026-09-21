import type { InboxStore } from '../../shared/events/index.js';
import { clampBatchSize } from '../../shared/pagination/index.js';
import type { Transaction } from '../../shared/persistence/index.js';
import type { PostgresDatabase } from './postgres-database.js';

/**
 * Consumer-side deduplication.
 *
 * The primitive is a conditional INSERT: the `(consumer_name, event_id)`
 * primary key means only the first delivery can claim the row, and
 * `ON CONFLICT DO NOTHING` turns the duplicate into a cheap no-op instead of
 * an error the caller has to interpret.
 *
 * A previously failed delivery is allowed to retry, so a transient handler
 * error does not permanently drop the event.
 */
export class PostgresInboxRepository implements InboxStore {
  constructor(private readonly database: PostgresDatabase) {}

  /**
   * Reserves (consumer, event) for processing.
   *
   * @returns `true` when this delivery owns the work, `false` when the event
   * was already processed or is being processed right now.
   */
  async beginProcessing(
    transaction: Transaction,
    consumerName: string,
    eventId: string,
    eventType: string,
  ): Promise<boolean> {
    const result = await transaction.query(
      `INSERT INTO inbox_messages (consumer_name, event_id, event_type, status)
       VALUES ($1, $2, $3, 'processing')
       ON CONFLICT (consumer_name, event_id) DO UPDATE
         SET status = 'processing',
             attempt_count = inbox_messages.attempt_count + 1,
             last_error = NULL
         WHERE inbox_messages.status = 'failed'
       RETURNING event_id`,
      [consumerName, eventId, eventType],
      { operation: 'inbox.begin_processing' },
    );

    // No row returned means the conflict target was 'processing' or
    // 'processed', so this delivery is a duplicate.
    return result.rowCount > 0;
  }

  async markProcessed(
    transaction: Transaction,
    consumerName: string,
    eventId: string,
  ): Promise<void> {
    await transaction.query(
      `UPDATE inbox_messages
       SET status = 'processed', processed_at = now(), last_error = NULL
       WHERE consumer_name = $1 AND event_id = $2`,
      [consumerName, eventId],
      { operation: 'inbox.mark_processed' },
    );
  }

  async markFailed(
    transaction: Transaction,
    consumerName: string,
    eventId: string,
    error: string,
  ): Promise<void> {
    await transaction.query(
      `UPDATE inbox_messages
       SET status = 'failed', last_error = left($3, 1000)
       WHERE consumer_name = $1 AND event_id = $2`,
      [consumerName, eventId, error],
      { operation: 'inbox.mark_failed' },
    );
  }

  /** Retention sweep; the ledger only needs to cover the redelivery window. */
  async purgeProcessedBefore(cutoff: Date, batchSize: number): Promise<number> {
    const limit = clampBatchSize(batchSize);
    const result = await this.database.query(
      `DELETE FROM inbox_messages
       WHERE (consumer_name, event_id) IN (
         SELECT consumer_name, event_id
         FROM inbox_messages
         WHERE status = 'processed' AND processed_at < $1
         LIMIT $2
       )`,
      [cutoff, limit],
      { operation: 'inbox.purge_processed' },
    );
    return result.rowCount;
  }
}
