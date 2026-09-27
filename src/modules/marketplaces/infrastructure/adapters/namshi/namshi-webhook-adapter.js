import { MarketplaceWebhookEventKind } from '../../../../marketplace-webhook-ingestion/public/marketplace-webhook-event-kind.js';
import {
    MarketplaceWebhookPermanentError,
    MarketplaceWebhookUnsupportedError,
} from '../../../../marketplace-webhook-ingestion/application/marketplace-webhook-errors.js';
import { MarketplaceValidationError } from '../../../domain/marketplace-errors.js';
import { NAMSHI_MARKETPLACE_KEY } from './namshi-catalog-adapter.js';
import { parseNamshiFbpiWebhookEvent } from './parse-namshi-fbpi-webhook-event.js';
import { buildNamshiFbpiLifecycleEventId } from './map-namshi-fbpi-order-to-lifecycle-command.js';

export class NamshiWebhookAdapter {
    marketplaceKey = NAMSHI_MARKETPLACE_KEY;

    getWebhookCapabilities() {
        return { supportsInboundWebhooks: true };
    }

    /**
     * Ingress token resolves tenant/channel; FBPI events do not carry a separate HMAC in Nexora.
     *
     * @param {import('../../../../marketplace-webhook-ingestion/public/marketplace-webhook-adapter.port.js').MarketplaceWebhookRequestContext} _context
     */
    async authenticateWebhookRequest(_context) {
        return undefined;
    }

    /**
     * @param {import('../../../../marketplace-webhook-ingestion/public/marketplace-webhook-adapter.port.js').MarketplaceWebhookRequestContext} context
     */
    async normalizeWebhookEvent(context) {
        let event;
        try {
            event = JSON.parse(context.rawBody);
        }
        catch {
            throw new MarketplaceWebhookPermanentError('Namshi FBPI webhook body is not valid JSON');
        }
        let parsed;
        try {
            parsed = parseNamshiFbpiWebhookEvent(event);
        }
        catch (error) {
            if (error instanceof MarketplaceValidationError && error.message.includes('event_type is not supported')) {
                throw new MarketplaceWebhookUnsupportedError(error.message, error.safeDetails);
            }
            if (error instanceof MarketplaceValidationError) {
                throw new MarketplaceWebhookPermanentError(error.message, error.safeDetails);
            }
            throw new MarketplaceWebhookPermanentError(error instanceof Error ? error.message : 'Namshi FBPI webhook is invalid');
        }
        const deduplicationKey = buildNamshiFbpiLifecycleEventId({
            messageId: parsed.messageId,
            orderNr: parsed.orderNr,
            publishedAt: parsed.publishedAt,
            eventType: parsed.eventType,
        });
        return {
            deduplicationKey,
            eventKind: MarketplaceWebhookEventKind.ORDER_UPDATE,
            marketplaceKey: this.marketplaceKey,
            resource: {
                type: 'order',
                lifecyclePayload: {
                    source: 'fbpi_order_sync',
                    event,
                },
            },
        };
    }
}
