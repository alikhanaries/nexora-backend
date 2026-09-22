/**
 * Routes a validated integration event through multiple inbox-backed handlers.
 *
 * Each handler keeps its own inbox consumer name so at-least-once delivery and
 * deduplication remain per consumer, not per pipeline.
 */
export class CompositeIntegrationEventRouter {
    consumers;
    constructor(consumers) {
        this.consumers = consumers;
    }
    async route(event) {
        for (const consumer of this.consumers) {
            await consumer.handle(event);
        }
    }
}
