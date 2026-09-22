import { z } from 'zod';
import { JobName, QueueName } from '../../infrastructure/queue/queue-names.js';
import { parseOrThrow } from '../../shared/validation/index.js';
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
export function registerWorkerHandlers(deps) {
    const publishHandler = async (payload, context) => {
        if (context.name !== JobName.PUBLISH_INTEGRATION_EVENT) {
            return;
        }
        const parsed = parseOrThrow(integrationEventPayloadSchema, payload, 'integration event job');
        await deps.integrationEventRouter.route({
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
