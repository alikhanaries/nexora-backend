import { z } from 'zod';

/**
 * Provider-neutral integration event emitted by domain modules and persisted
 * through the transactional outbox. This contract intentionally excludes
 * repositories, SQL, compatibility types, and domain entity classes.
 */

/** @typedef {Record<string, unknown>} IntegrationEventPayload */

/**
 * Event shape produced inside a business transaction before outbox persistence.
 * `id` and `occurredAt` are assigned by the outbox when omitted.
 *
 * @typedef {object} IntegrationEventInput
 * @property {string} [id]
 * @property {string} type
 * @property {number} version
 * @property {string} aggregateType
 * @property {string} aggregateId
 * @property {string|null} [tenantId]
 * @property {IntegrationEventPayload} payload
 * @property {string|null} [correlationId]
 * @property {Date} [occurredAt]
 */

/**
 * Complete integration event after outbox persistence or queue delivery.
 *
 * @typedef {object} IntegrationEvent
 * @property {string} id
 * @property {string} type
 * @property {number} version
 * @property {string} aggregateType
 * @property {string} aggregateId
 * @property {string|null} tenantId
 * @property {IntegrationEventPayload} payload
 * @property {string|null} correlationId
 * @property {Date} occurredAt
 */

const eventTypeSchema = z
    .string()
    .min(1)
    .max(128)
    .regex(/^[a-z][a-z0-9]*(?:[._][a-z0-9]+)*$/, 'event type must use lowercase dot-separated segments');

const integrationEventInputSchema = z.object({
    id: z.string().uuid().optional(),
    type: eventTypeSchema,
    version: z.number().int().positive(),
    aggregateType: z.string().min(1).max(64),
    aggregateId: z.string().min(1).max(128),
    tenantId: z.string().uuid().nullable().optional(),
    payload: z.record(z.unknown()),
    correlationId: z.string().min(1).max(128).nullable().optional(),
    occurredAt: z.date().optional(),
});

const integrationEventSchema = integrationEventInputSchema.extend({
    id: z.string().uuid(),
    tenantId: z.string().uuid().nullable(),
    correlationId: z.string().min(1).max(128).nullable(),
    occurredAt: z.date(),
});

/**
 * @param {unknown} value
 * @returns {IntegrationEventInput}
 */
export function parseIntegrationEventInput(value) {
    return integrationEventInputSchema.parse(value);
}

/**
 * @param {unknown} value
 * @returns {IntegrationEvent}
 */
export function parseIntegrationEvent(value) {
    return integrationEventSchema.parse(value);
}

/**
 * Normalizes a persisted or queued event record into the shared contract.
 *
 * @param {unknown} value
 * @returns {IntegrationEvent}
 */
export function normalizeIntegrationEvent(value) {
    const parsed = integrationEventSchema.parse(value);
    return {
        id: parsed.id,
        type: parsed.type,
        version: parsed.version,
        aggregateType: parsed.aggregateType,
        aggregateId: parsed.aggregateId,
        tenantId: parsed.tenantId,
        payload: parsed.payload,
        correlationId: parsed.correlationId,
        occurredAt: parsed.occurredAt,
    };
}

/**
 * Returns true when `value` satisfies the complete integration event contract.
 *
 * @param {unknown} value
 * @returns {value is IntegrationEvent}
 */
export function isIntegrationEvent(value) {
    return integrationEventSchema.safeParse(value).success;
}

export { integrationEventInputSchema, integrationEventSchema, eventTypeSchema };
