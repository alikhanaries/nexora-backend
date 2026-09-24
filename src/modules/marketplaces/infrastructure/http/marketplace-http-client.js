import { MarketplaceTransientError } from '../../domain/marketplace-errors.js';
import { mapHttpStatusToMarketplaceError } from './map-http-status-to-marketplace-error.js';

/**
 * Transport-only HTTP client for marketplace adapters.
 * Provider adapters supply URL, method, headers, and body.
 */
export class MarketplaceHttpClient {
    /** @param {{ timeoutMs?: number, fetchImpl?: typeof fetch }} [options] */
    constructor(options = {}) {
        this.timeoutMs = options.timeoutMs ?? 30_000;
        this.fetchImpl = options.fetchImpl ?? fetch;
    }

    /**
     * @param {object} request
     * @param {string} request.url
     * @param {string} [request.method]
     * @param {Record<string, string>} [request.headers]
     * @param {string | undefined} [request.body]
     * @param {string} [request.correlationId]
     */
    async request(request) {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), this.timeoutMs);
        try {
            const response = await this.fetchImpl(request.url, {
                method: request.method ?? 'GET',
                headers: request.headers,
                body: request.body,
                signal: controller.signal,
            });
            const text = await response.text();
            let json;
            if (text.length > 0) {
                try {
                    json = JSON.parse(text);
                }
                catch {
                    json = undefined;
                }
            }
            if (!response.ok) {
                throw mapHttpStatusToMarketplaceError(response.status, {
                    retryAfterHeader: response.headers.get('retry-after'),
                    body: json ?? text,
                });
            }
            return { status: response.status, json, text };
        }
        catch (error) {
            if (error instanceof Error && error.name === 'AbortError') {
                throw new MarketplaceTransientError('Marketplace HTTP request timed out', {
                    retryDelayMs: 5_000,
                });
            }
            throw error;
        }
        finally {
            clearTimeout(timer);
        }
    }
}
