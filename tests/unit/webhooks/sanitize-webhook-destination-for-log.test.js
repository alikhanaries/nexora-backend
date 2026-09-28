import { describe, expect, it } from 'vitest';
import { sanitizeWebhookDestinationForLog } from '../../../src/modules/webhooks/application/sanitize-webhook-destination-for-log.js';

describe('sanitizeWebhookDestinationForLog', () => {
    it('returns host and path without credentials', () => {
        expect(sanitizeWebhookDestinationForLog('https://user:secret@stockconnect.example/orders/channelengine-webhook'))
            .toEqual({
                destinationHost: 'stockconnect.example',
                destinationPath: '/orders/channelengine-webhook',
            });
    });

    it('returns null for empty input', () => {
        expect(sanitizeWebhookDestinationForLog('')).toBeNull();
    });
});
