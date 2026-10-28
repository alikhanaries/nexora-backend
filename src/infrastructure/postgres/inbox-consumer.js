import { toErrorMessage } from '../../shared/errors/index.js';
/**
 * Wraps a handler with inbox deduplication so at-least-once delivery is safe.
 *
 * The handler runs only when `beginProcessing` claims the (consumer, eventId)
 * pair. Duplicate deliveries see a conflict and are dropped.
 */
export class InboxConsumer {
    database;
    inbox;
    handler;
    logger;
    /** @param {import('./postgres-database.js').PostgresDatabase} database @param {import('./inbox-repository.js').PostgresInboxRepository} inbox */
    constructor(database, inbox, handler, logger) {
        this.database = database;
        this.inbox = inbox;
        this.handler = handler;
        this.logger = logger;
    }
    /** Claims inbox row, invokes handler in one DB transaction, marks processed or failed. */
    async handle(event) {
        const executeOptions = typeof event.tenantId === 'string' && event.tenantId.length > 0
            ? { tenantId: event.tenantId }
            : {};
        const claimed = await this.database.execute(async (tx) => {
            const reserved = await this.inbox.beginProcessing(tx, this.handler.consumerName, event.id, event.type);
            if (!reserved) {
                this.logger.debug({ consumer: this.handler.consumerName, eventId: event.id }, 'Duplicate event delivery skipped');
                return false;
            }
            try {
                await this.handler.handle(event);
                await this.inbox.markProcessed(tx, this.handler.consumerName, event.id);
                return true;
            }
            catch (error) {
                await this.inbox.markFailed(tx, this.handler.consumerName, event.id, toErrorMessage(error));
                throw error;
            }
        }, executeOptions);
        if (claimed === false)
            return;
    }
}
