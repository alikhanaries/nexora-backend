import { createHash } from 'node:crypto';
import { MarketplaceAuthenticationError } from '../../../domain/marketplace-errors.js';
import { MarketplaceHttpClient } from '../../http/marketplace-http-client.js';
import { readAmazonLwaCredentials, resolveAmazonLwaTokenUrl } from './amazon-config.js';

export class AmazonLwaTokenProvider {
    http;
    /** @type {Map<string, { accessToken: string, expiresAtMs: number }>} */
    tokenCache;

    /**
     * @param {{ http?: MarketplaceHttpClient }} [deps]
     */
    constructor(deps = {}) {
        this.http = deps.http ?? new MarketplaceHttpClient();
        this.tokenCache = new Map();
    }

    /**
     * @param {import('../../../../channel-catalog-sync/public/marketplace-adapter-runtime.port.js').MarketplaceAdapterRuntime} runtime
     * @param {string | null | undefined} [deploymentLwaTokenUrl]
     */
    async getAccessToken(runtime, deploymentLwaTokenUrl) {
        const cacheKey = buildCacheKey(runtime.credentials, resolveAmazonLwaTokenUrl(
            runtime.configuration ?? {},
            deploymentLwaTokenUrl,
        ));
        const cached = this.tokenCache.get(cacheKey);
        if (cached !== undefined && cached.expiresAtMs > Date.now() + 60_000) {
            return cached.accessToken;
        }
        const { clientId, clientSecret, refreshToken } = readAmazonLwaCredentials(runtime.credentials);
        const tokenUrl = resolveAmazonLwaTokenUrl(runtime.configuration ?? {}, deploymentLwaTokenUrl);
        const response = await this.http.request({
            url: tokenUrl,
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: new URLSearchParams({
                grant_type: 'refresh_token',
                refresh_token: refreshToken,
                client_id: clientId,
                client_secret: clientSecret,
            }).toString(),
        });
        const accessToken = response.json?.access_token;
        if (typeof accessToken !== 'string' || accessToken.length === 0) {
            throw new MarketplaceAuthenticationError('Amazon LWA token response did not include access_token');
        }
        const expiresInRaw = response.json?.expires_in;
        const expiresInSeconds = typeof expiresInRaw === 'number' && Number.isFinite(expiresInRaw)
            ? Math.max(60, Math.floor(expiresInRaw))
            : 3_600;
        this.tokenCache.set(cacheKey, {
            accessToken,
            expiresAtMs: Date.now() + expiresInSeconds * 1_000,
        });
        return accessToken;
    }
}

/**
 * @param {Record<string, unknown>} credentials
 */
function buildCacheKey(credentials, lwaTokenUrl) {
    const { clientId, refreshToken } = readAmazonLwaCredentials(credentials);
    const digest = createHash('sha256')
        .update(`${clientId}\0${refreshToken}\0${lwaTokenUrl}`, 'utf8')
        .digest('hex');
    return digest;
}
