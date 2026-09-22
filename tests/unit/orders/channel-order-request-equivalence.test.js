import { describe, expect, it } from 'vitest';
import { isEquivalentChannelOrderRequest } from '../../../src/modules/orders/application/channel-order-request-equivalence.js';

describe('isEquivalentChannelOrderRequest', () => {
    const existingOrder = {
        channelId: 'channel-1',
        currency: 'USD',
        discountMinor: 0,
        taxMinor: 0,
        shippingMinor: 0,
    };

    it('returns true for matching line and customer snapshots', () => {
        const equivalent = isEquivalentChannelOrderRequest(existingOrder, [{
            productId: 'product-1',
            stockLocationId: 'location-1',
            quantity: 2,
            offerId: 'offer-1',
        }], {
            firstName: 'Ada',
            lastName: 'Lovelace',
            email: 'ada@example.com',
        }, {
            channelId: 'channel-1',
            currency: 'USD',
            discountMinor: 0,
            taxMinor: 0,
            shippingMinor: 0,
            customer: {
                firstName: 'Ada',
                lastName: 'Lovelace',
                email: 'ada@example.com',
            },
        }, [{
            productId: 'product-1',
            input: {
                stockLocationId: 'location-1',
                quantity: 2,
            },
            offerId: 'offer-1',
        }]);

        expect(equivalent).toBe(true);
    });

    it('returns false when line quantities differ', () => {
        const equivalent = isEquivalentChannelOrderRequest(existingOrder, [{
            productId: 'product-1',
            stockLocationId: 'location-1',
            quantity: 2,
            offerId: null,
        }], null, {
            channelId: 'channel-1',
            currency: 'USD',
            customer: {},
        }, [{
            productId: 'product-1',
            input: {
                stockLocationId: 'location-1',
                quantity: 3,
            },
            offerId: null,
        }]);

        expect(equivalent).toBe(false);
    });
});
