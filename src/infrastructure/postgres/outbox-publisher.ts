import type { OutboxConfig } from '../../shared/config/index.js';
import { toErrorMessage } from '../../shared/errors/index.js';
import type { Logger } from '../../shared/logging/index.js';
import type { JobQueue } from '../../shared/queue/index.js';
import { JobName, QueueName } from '../queue/queue-names.js';
import type { PostgresOutboxRepository } from './outbox-repository.js';

/**
 * Polls the outbox and hands events to BullMQ.
 *
 * Delivery semantics: AT-LEAST-ONCE. A crash between queue publish and
 * `markPublished` means the event may be enqueued again. Consumers must be
 * idempotent (inbox deduplication).
 *
 * No external I/O runs inside a database transaction.
 */
export class OutboxPublisher {
  private timer: NodeJS.Timeout | undefined;
  private running = false;
  private stopped = false;

  constructor(
    private readonly outbox: PostgresOutboxRepository,
    private readonly queue: JobQueue,
    private readonly config: OutboxConfig,
    private readonly logger: Logger,
  ) {}

  start(): void {
    if (this.timer !== undefined) return;
    this.timer = setInterval(() => {
      void this.tick();
    }, this.config.pollIntervalMs);
    void this.tick();
    this.logger.info({ pollIntervalMs: this.config.pollIntervalMs }, 'Outbox publisher started');
  }

  async stop(): Promise<void> {
    this.stopped = true;
    if (this.timer !== undefined) {
      clearInterval(this.timer);
      this.timer = undefined;
    }
    while (this.running) {
      await sleep(50);
    }
    this.logger.info({}, 'Outbox publisher stopped');
  }

  /** One publish cycle; exposed for tests. */
  async tick(): Promise<number> {
    if (this.stopped) return 0;
    if (this.running) return 0;

    this.running = true;
    let published = 0;

    try {
      await this.outbox.releaseStaleClaims(this.config.pollIntervalMs * 3);
      const batch = await this.outbox.claimBatch(this.config.batchSize, this.config.maxAttempts);

      for (const event of batch) {
        try {
          await this.queue.enqueue(
            QueueName.INTEGRATION_EVENTS,
            JobName.PUBLISH_INTEGRATION_EVENT,
            {
              eventId: event.id,
              eventType: event.type,
              eventVersion: event.version,
              aggregateType: event.aggregateType,
              aggregateId: event.aggregateId,
              tenantId: event.tenantId,
              payload: event.payload,
              occurredAt: event.occurredAt.toISOString(),
              correlationId: event.correlationId,
            },
            { jobId: event.id },
          );
          await this.outbox.markPublished([event.id]);
          published += 1;
        } catch (error) {
          await this.outbox.markFailed(event.id, toErrorMessage(error), this.config.maxAttempts);
          this.logger.error(
            { eventId: event.id, reason: toErrorMessage(error) },
            'Outbox publish failed',
          );
        }
      }
    } finally {
      this.running = false;
    }

    return published;
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}
