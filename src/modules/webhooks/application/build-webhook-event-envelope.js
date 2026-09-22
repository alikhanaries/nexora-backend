/**
 * Builds the stable external webhook JSON body from an integration event.
 *
 * The returned string is the exact UTF-8 payload that must be signed and sent.
 *
 * @param {import('../../../shared/events/integration-event.js').IntegrationEvent} event
 */
export function buildWebhookEventEnvelope(event) {
    const envelope = {
        id: event.id,
        type: event.type,
        version: event.version,
        aggregateType: event.aggregateType,
        aggregateId: event.aggregateId,
        tenantId: event.tenantId,
        payload: event.payload,
        occurredAt: event.occurredAt.toISOString(),
        correlationId: event.correlationId,
    };
    return JSON.stringify(envelope);
}
