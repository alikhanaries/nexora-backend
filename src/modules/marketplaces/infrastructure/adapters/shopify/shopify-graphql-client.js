import {
    MarketplaceRateLimitError,
    MarketplaceValidationError,
} from '../../../domain/marketplace-errors.js';
import { MarketplaceHttpClient } from '../../http/marketplace-http-client.js';
import {
    readShopifyCredentials,
    resolveShopifyAdminApiVersion,
} from './shopify-config.js';

export class ShopifyGraphqlClient {
    http;
    /** @type {string | null | undefined} */
    deploymentDefaultApiVersion;

    /**
     * @param {{ http?: MarketplaceHttpClient, deploymentDefaultApiVersion?: string | null }} [deps]
     */
    constructor(deps = {}) {
        this.http = deps.http ?? new MarketplaceHttpClient();
        this.deploymentDefaultApiVersion = deps.deploymentDefaultApiVersion;
    }

    /**
     * @param {import('../../../../channel-catalog-sync/public/marketplace-adapter-runtime.port.js').MarketplaceAdapterRuntime} runtime
     * @param {string} query
     * @param {Record<string, unknown>} variables
     */
    async execute(runtime, query, variables) {
        const { shopDomain, accessToken } = readShopifyCredentials(runtime.credentials);
        const apiVersion = resolveShopifyAdminApiVersion(
            runtime.configuration ?? {},
            this.deploymentDefaultApiVersion,
        );
        const url = `https://${shopDomain}/admin/api/${apiVersion}/graphql.json`;
        const response = await this.http.request({
            url,
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-Shopify-Access-Token': accessToken,
            },
            body: JSON.stringify({ query, variables }),
        });
        const json = response.json;
        if (json === undefined || typeof json !== 'object') {
            throw new MarketplaceValidationError('Shopify returned a non-JSON GraphQL response');
        }
        const errors = json.errors;
        if (Array.isArray(errors) && errors.length > 0) {
            const first = errors[0];
            if (first !== null && typeof first === 'object' && first.extensions?.code === 'THROTTLED') {
                throw new MarketplaceRateLimitError(undefined, { retryAfterSeconds: 2 });
            }
            throw new MarketplaceValidationError(first?.message ?? 'Shopify GraphQL error');
        }
        const userErrors = collectUserErrors(json.data);
        if (userErrors.length > 0) {
            throw new MarketplaceValidationError(userErrors[0]?.message ?? 'Shopify user error');
        }
        return json.data;
    }
}

/**
 * @param {unknown} data
 */
function collectUserErrors(data) {
    if (data === null || typeof data !== 'object') {
        return [];
    }
    /** @type {Array<{ message?: string }>} */
    const collected = [];
    for (const value of Object.values(data)) {
        if (value !== null && typeof value === 'object' && Array.isArray(value.userErrors)) {
            collected.push(...value.userErrors);
        }
    }
    return collected;
}
