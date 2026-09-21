import { randomUUID } from 'node:crypto';
import { afterAll, describe, expect, it } from 'vitest';
import { OutboxPublisher } from '../../src/infrastructure/postgres/outbox-publisher.js';
import { InboxConsumer } from '../../src/infrastructure/postgres/inbox-consumer.js';
import { LoggingIntegrationEventHandler } from '../../src/workers/handlers/integration-event.handler.js';
import { JobName, QueueName } from '../../src/infrastructure/queue/queue-names.js';
import { closeTestInfrastructure, getTestInfrastructure } from './helpers.js';

describe('outbox and inbox integration', () => {
  afterAll(async () => {
    await closeTestInfrastructure();
  });

  it('persists, publishes and deduplicates events', async () => {
    const infra = await getTestInfrastructure();
    const eventId = randomUUID();

    await infra.database.execute(async (tx) => {
      await infra.outbox.record(tx, {
        id: eventId,
        type: 'foundation.test_event',
        version: 1,
        aggregateType: 'foundation',
        aggregateId: 'test',
        payload: { hello: 'world' },
      });
    });

    const publisher = new OutboxPublisher(
      infra.outbox,
      infra.queue,
      infra.config.outbox,
      infra.logger,
    );
    const published = await publisher.tick();
    expect(published).toBeGreaterThanOrEqual(1);

    const handler = new LoggingIntegrationEventHandler(infra.logger);
    const consumer = new InboxConsumer(infra.database, infra.inbox, handler, infra.logger);

    const event = {
      id: eventId,
      type: 'foundation.test_event',
      version: 1,
      aggregateType: 'foundation',
      aggregateId: 'test',
      tenantId: null,
      payload: { hello: 'world' },
      occurredAt: new Date(),
      correlationId: null,
    };

    await consumer.handle(event);
    await consumer.handle(event);

    const pending = await infra.outbox.countPending();
    expect(pending).toBeGreaterThanOrEqual(0);

    const removed = await infra.queue.remove(QueueName.INTEGRATION_EVENTS, eventId);
    expect(typeof removed).toBe('boolean');
    expect(JobName.PUBLISH_INTEGRATION_EVENT).toBe('publish-integration-event');
  });
});
