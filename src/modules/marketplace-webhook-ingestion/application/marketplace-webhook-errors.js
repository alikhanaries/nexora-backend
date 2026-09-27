import {
    AuthenticationError,
    BusinessRuleError,
    ServiceUnavailableError,
} from '../../../shared/errors/index.js';

/** Adapter rejected webhook authenticity (signature, token, etc.). */
export class MarketplaceWebhookAuthenticationError extends AuthenticationError {
    constructor(message = 'Marketplace webhook authentication failed', safeDetails) {
        super(message, safeDetails);
        this.name = 'MarketplaceWebhookAuthenticationError';
    }
}

/** Marketplace or event type does not support inbound webhooks yet. */
export class MarketplaceWebhookUnsupportedError extends BusinessRuleError {
    constructor(message = 'Marketplace webhook capability is not supported', safeDetails) {
        super(message, safeDetails);
        this.name = 'MarketplaceWebhookUnsupportedError';
    }
}

/** Normalized event kind or payload cannot be processed; do not retry. */
export class MarketplaceWebhookPermanentError extends BusinessRuleError {
    constructor(message, safeDetails) {
        super(message, safeDetails);
        this.name = 'MarketplaceWebhookPermanentError';
    }
}

/** Transient failure; marketplace or Nexora may retry delivery. */
export class MarketplaceWebhookRetryableError extends ServiceUnavailableError {
    /**
     * @param {string} [message]
     * @param {{ retryAfterSeconds?: number | null, safeDetails?: Record<string, unknown> }} [options]
     */
    constructor(message = 'Marketplace webhook processing failed temporarily', options = {}) {
        super(message, {
            ...(options.safeDetails ?? {}),
            retryAfterSeconds: options.retryAfterSeconds ?? 5,
        });
        this.name = 'MarketplaceWebhookRetryableError';
    }
}
