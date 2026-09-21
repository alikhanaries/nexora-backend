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
    constructor(database, inbox, handler, logger) {
        this.database = database;
        this.inbox = inbox;
        this.handler = handler;
        this.logger = logger;
    }
    async handle(event) {
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
        });
        if (claimed === false)
            return;
    }
}
