/** @typedef {import('./integration-event.js').IntegrationEvent} IntegrationEvent */

/**
 * @typedef {object} IntegrationEventHandler
 * @property {string} consumerName Inbox deduplication key for this handler.
 * @property {(event: IntegrationEvent) => Promise<void>} handle
 */

export {};
