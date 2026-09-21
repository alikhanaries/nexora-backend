import { z } from 'zod';
import type { InboxConsumer } from '../../infrastructure/postgres/inbox-consumer.js';
import { JobName, QueueName } from '../../infrastructure/queue/queue-names.js';
import type { BullMqWorkerRuntime } from '../../infrastructure/queue/bullmq-worker-runtime.js';
import type { JobHandler } from '../../shared/queue/index.js';
import { parseOrThrow } from '../../shared/validation/index.js';
import type { LoggingIntegrationEventHandler } from './integration-event.handler.js';

const integrationEventPayloadSchema = z.object({
  eventId: z.string().uuid(),
  eventType: z.string(),
  eventVersion: z.number().int(),
  aggregateType: z.string(),
  aggregateId: z.string(),
  tenantId: z.string().uuid().nullable(),
  payload: z.record(z.unknown()),
  occurredAt: z.string(),
  correlationId: z.string().nullable(),
});

export function registerWorkerHandlers(deps: {
  readonly workerRuntime: BullMqWorkerRuntime;
  readonly inboxConsumer: InboxConsumer;
  readonly handler: LoggingIntegrationEventHandler;
}): void {
  const publishHandler: JobHandler = async (payload, context) => {
    if (context.name !== JobName.PUBLISH_INTEGRATION_EVENT) {
      return;
    }
    const parsed = parseOrThrow(integrationEventPayloadSchema, payload, 'integration event job');
    await deps.inboxConsumer.handle({
      id: parsed.eventId,
      type: parsed.eventType,
      version: parsed.eventVersion,
      aggregateType: parsed.aggregateType,
      aggregateId: parsed.aggregateId,
      tenantId: parsed.tenantId,
      payload: parsed.payload,
      occurredAt: new Date(parsed.occurredAt),
      correlationId: parsed.correlationId,
    });
  };

  deps.workerRuntime.register(QueueName.INTEGRATION_EVENTS, publishHandler);
}
