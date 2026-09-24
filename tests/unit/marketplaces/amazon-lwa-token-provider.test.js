import { describe, expect, it, vi } from 'vitest';
import { AmazonLwaTokenProvider } from '../../../src/modules/marketplaces/infrastructure/adapters/amazon/amazon-lwa-token-provider.js';
import { MarketplaceHttpClient } from '../../../src/modules/marketplaces/infrastructure/http/marketplace-http-client.js';
import { MarketplaceAuthenticationError } from '../../../src/modules/marketplaces/domain/marketplace-errors.js';

const runtime = {
    marketplaceKey: 'amazon',
    connectionRequired: true,
    credentials: {
        clientId: 'amzn1.application-oa2-client.test',
        clientSecret: 'secret',
        refreshToken: 'Atzr|refresh',
        awsAccessKeyId: 'AKIAEXAMPLE',
        awsSecretAccessKey: 'aws-secret',
        sellerId: 'SELLER123',
    },
    configuration: { marketplaceId: 'ATVPDKIKX0DER', region: 'na' },
};

describe('AmazonLwaTokenProvider', () => {
    it('obtains and caches access token per connection', async () => {
        const fetchImpl = vi.fn(async () => new Response(JSON.stringify({
            access_token: 'Atza|access',
            expires_in: 3600,
        }), { status: 200 }));
        const provider = new AmazonLwaTokenProvider({
            http: new MarketplaceHttpClient({ fetchImpl }),
        });
        const first = await provider.getAccessToken(runtime);
        const second = await provider.getAccessToken(runtime);
        expect(first).toBe('Atza|access');
        expect(second).toBe('Atza|access');
        expect(fetchImpl).toHaveBeenCalledTimes(1);
        const [, init] = fetchImpl.mock.calls[0];
        expect(init.body).toContain('refresh_token=');
        expect(String(init.body)).toContain('grant_type=refresh_token');
    });

    it('isolates cache entries by refresh token', async () => {
        const fetchImpl = vi.fn(async () => new Response(JSON.stringify({
            access_token: 'Atza|access',
            expires_in: 3600,
        }), { status: 200 }));
        const provider = new AmazonLwaTokenProvider({
            http: new MarketplaceHttpClient({ fetchImpl }),
        });
        await provider.getAccessToken(runtime);
        await provider.getAccessToken({
            ...runtime,
            credentials: { ...runtime.credentials, refreshToken: 'Atzr|other' },
        });
        expect(fetchImpl).toHaveBeenCalledTimes(2);
    });

    it('throws authentication error when token missing', async () => {
        const fetchImpl = vi.fn(async () => new Response(JSON.stringify({}), { status: 200 }));
        const provider = new AmazonLwaTokenProvider({
            http: new MarketplaceHttpClient({ fetchImpl }),
        });
        await expect(provider.getAccessToken(runtime)).rejects.toBeInstanceOf(MarketplaceAuthenticationError);
    });
});
