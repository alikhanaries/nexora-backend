/**
 * Port for recording integration events inside a business transaction.
 *
 * The concrete implementation lives in infrastructure (`PostgresOutboxRepository`)
 * and is wired as `eventRecorder` in the composition root. Domain modules depend
 * on this port shape only — never on SQL or repository classes.
 */

/** @typedef {import('./integration-event.js').IntegrationEventInput} IntegrationEventInput */

/**
 * @typedef {object} EventRecorderPort
 * @property {(transaction: object, event: IntegrationEventInput) => Promise<void>} record
 * Persists one event in the caller's transaction.
 *
 * @property {(transaction: object, events: IntegrationEventInput[]) => Promise<void>} recordMany
 * Persists multiple events in the caller's transaction.
 */

export {};
