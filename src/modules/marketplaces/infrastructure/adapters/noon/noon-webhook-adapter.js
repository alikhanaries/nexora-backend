import { MarketplaceWebhookEventKind } from '../../../../marketplace-webhook-ingestion/public/marketplace-webhook-event-kind.js';
import {
    MarketplaceWebhookPermanentError,
    MarketplaceWebhookUnsupportedError,
} from '../../../../marketplace-webhook-ingestion/application/marketplace-webhook-errors.js';
import { NOON_MARKETPLACE_KEY } from './noon-catalog-adapter.js';
import {
    NOON_FBPI_ORDER_SYNC_EVENT_TYPE,
    parseNoonEventNotification,
    readNoonEventOrderNr,
} from './parse-noon-event-notification.js';

export class NoonWebhookAdapter {
    marketplaceKey = NOON_MARKETPLACE_KEY;

    getWebhookCapabilities() {
        return { supportsInboundWebhooks: true };
    }

    /**
     * Nexora ingress token routes the connection; Noon Event Notifications optional credentials
     * are configured in noon and validated at the network edge by the integrator when required.
     *
     * @param {import('../../../../marketplace-webhook-ingestion/public/marketplace-webhook-adapter.port.js').MarketplaceWebhookRequestContext} context
     */
    async authenticateWebhookRequest(context) {
        parseNoonEventNotification(context.rawBody);
    }

    /**
     * @param {import('../../../../marketplace-webhook-ingestion/public/marketplace-webhook-adapter.port.js').MarketplaceWebhookRequestContext} context
     */
    async normalizeWebhookEvent(context) {
        const parsed = parseNoonEventNotification(context.rawBody);
        if (parsed.eventType !== NOON_FBPI_ORDER_SYNC_EVENT_TYPE) {
            throw new MarketplaceWebhookUnsupportedError('Noon event type is not supported for order lifecycle', {
                eventType: parsed.eventType,
            });
        }
        readNoonEventOrderNr(parsed.payload);
        const messageId = typeof parsed.metadata.message_id === 'string' ? parsed.metadata.message_id.trim() : '';
        if (messageId.length === 0) {
            throw new MarketplaceWebhookPermanentError('Noon event metadata.message_id is missing');
        }
        return {
            deduplicationKey: messageId,
            eventKind: MarketplaceWebhookEventKind.ORDER_UPDATE,
            marketplaceKey: this.marketplaceKey,
            resource: {
                type: 'order',
                lifecyclePayload: {
                    noonEvent: parsed.envelope,
                },
            },
        };
    }
}
