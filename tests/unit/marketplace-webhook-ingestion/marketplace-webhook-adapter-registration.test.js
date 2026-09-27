import { describe, expect, it } from 'vitest';
import { MarketplaceWebhookAdapterRegistry } from '../../../src/modules/marketplace-webhook-ingestion/public/marketplace-webhook-adapter-registry.js';
import { registerMarketplaceWebhookAdapters } from '../../../src/modules/marketplaces/infrastructure/adapters/register-marketplace-webhook-adapters.js';
import { AmazonWebhookAdapter } from '../../../src/modules/marketplaces/infrastructure/adapters/amazon/amazon-webhook-adapter.js';
import { NoonWebhookAdapter } from '../../../src/modules/marketplaces/infrastructure/adapters/noon/noon-webhook-adapter.js';

describe('registerMarketplaceWebhookAdapters', () => {
    it('registers provider-neutral inbound adapters for Amazon and Noon without optional Shopify deps', () => {
        const registry = new MarketplaceWebhookAdapterRegistry();
        registerMarketplaceWebhookAdapters(registry);
        expect(registry.resolve('amazon')).toBeInstanceOf(AmazonWebhookAdapter);
        expect(registry.resolve('noon')).toBeInstanceOf(NoonWebhookAdapter);
        expect(registry.resolve('shopify')).toBeNull();
    });
});
