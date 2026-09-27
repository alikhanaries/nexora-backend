import { MarketplaceWebhookEventKind } from '../../../../marketplace-webhook-ingestion/public/marketplace-webhook-event-kind.js';
import {
    MarketplaceWebhookPermanentError,
    MarketplaceWebhookUnsupportedError,
} from '../../../../marketplace-webhook-ingestion/application/marketplace-webhook-errors.js';
import { AMAZON_MARKETPLACE_KEY } from './amazon-catalog-adapter.js';
import { parseAmazonSnsEnvelope } from './parse-amazon-sns-envelope.js';

export class AmazonWebhookAdapter {
    marketplaceKey = AMAZON_MARKETPLACE_KEY;

    getWebhookCapabilities() {
        return { supportsInboundWebhooks: true };
    }

    /**
     * @param {import('../../../../marketplace-webhook-ingestion/public/marketplace-webhook-adapter.port.js').MarketplaceWebhookRequestContext} context
     */
    async authenticateWebhookRequest(context) {
        const parsed = parseAmazonSnsEnvelope(context.rawBody);
        if (parsed.kind === 'subscription_handshake') {
            throw new MarketplaceWebhookUnsupportedError('Amazon SNS subscription confirmation must be handled outside Nexora', {
                snsType: parsed.envelope.Type,
            });
        }
    }

    /**
     * @param {import('../../../../marketplace-webhook-ingestion/public/marketplace-webhook-adapter.port.js').MarketplaceWebhookRequestContext} context
     */
    async normalizeWebhookEvent(context) {
        const parsed = parseAmazonSnsEnvelope(context.rawBody);
        if (parsed.kind === 'subscription_handshake') {
            throw new MarketplaceWebhookUnsupportedError('Amazon SNS subscription handshake is not a marketplace event');
        }
        const message = parsed.message;
        if (message === null || typeof message !== 'object') {
            throw new MarketplaceWebhookPermanentError('Amazon notification message is invalid');
        }
        if (message.NotificationType !== 'ORDER_CHANGE') {
            throw new MarketplaceWebhookUnsupportedError('Amazon notification type is not supported for order lifecycle', {
                notificationType: message.NotificationType,
            });
        }
        const change = message.Payload?.OrderChangeNotification;
        const amazonOrderId = typeof change?.AmazonOrderId === 'string' ? change.AmazonOrderId.trim() : '';
        if (amazonOrderId.length === 0) {
            throw new MarketplaceWebhookPermanentError('Amazon ORDER_CHANGE notification is missing AmazonOrderId');
        }
        const metadata = message.NotificationMetadata ?? {};
        const notificationId = typeof metadata.NotificationId === 'string' ? metadata.NotificationId : null;
        const deduplicationKey = notificationId ?? `${parsed.messageId ?? 'nosns'}:${amazonOrderId}`;
        return {
            deduplicationKey,
            eventKind: MarketplaceWebhookEventKind.ORDER_UPDATE,
            marketplaceKey: this.marketplaceKey,
            resource: {
                type: 'order',
                lifecyclePayload: {
                    notification: message,
                    snsMessageId: parsed.messageId,
                },
            },
        };
    }
}
