import { AwsSigV4RequestSigner } from '../../http/aws-sigv4-request-signer.js';
import { MarketplaceHttpClient } from '../../http/marketplace-http-client.js';
import {
    readAmazonAwsCredentials,
    readAmazonListingsProductType,
    readAmazonMarketplaceId,
    readAmazonSellerId,
    resolveAmazonAwsRegion,
    resolveAmazonSpApiHost,
} from './amazon-config.js';
import { AmazonLwaTokenProvider } from './amazon-lwa-token-provider.js';

export class AmazonSpApiClient {
    http;
    lwa;
    /** @type {string | null | undefined} */
    deploymentLwaTokenUrl;

    /**
     * @param {{ http?: MarketplaceHttpClient, lwa?: AmazonLwaTokenProvider, deploymentLwaTokenUrl?: string | null }} [deps]
     */
    constructor(deps = {}) {
        this.http = deps.http ?? new MarketplaceHttpClient();
        this.lwa = deps.lwa ?? new AmazonLwaTokenProvider({ http: this.http });
        this.deploymentLwaTokenUrl = deps.deploymentLwaTokenUrl;
    }

    /**
     * @param {import('../../../../channel-catalog-sync/public/marketplace-adapter-runtime.port.js').MarketplaceAdapterRuntime} runtime
     */
    async getMarketplaceParticipations(runtime) {
        const host = resolveAmazonSpApiHost(runtime.configuration ?? {});
        return this.signedRequest(runtime, {
            url: `${host}/sellers/v1/marketplaceParticipations`,
            method: 'GET',
        });
    }

    /**
     * @param {import('../../../../channel-catalog-sync/public/marketplace-adapter-runtime.port.js').MarketplaceAdapterRuntime} runtime
     * @param {string} sku
     * @param {object[]} patches
     */
    async patchListingItem(runtime, sku, patches) {
        const host = resolveAmazonSpApiHost(runtime.configuration ?? {});
        const sellerId = readAmazonSellerId(runtime.credentials);
        const marketplaceId = readAmazonMarketplaceId(runtime.configuration ?? {});
        const productType = readAmazonListingsProductType(runtime.configuration ?? {});
        const url = `${host}/listings/2021-08-01/items/${encodeURIComponent(sellerId)}/${encodeURIComponent(sku)}?marketplaceIds=${encodeURIComponent(marketplaceId)}`;
        return this.signedRequest(runtime, {
            url,
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ productType, patches }),
        });
    }

    /**
     * @param {import('../../../../channel-catalog-sync/public/marketplace-adapter-runtime.port.js').MarketplaceAdapterRuntime} runtime
     * @param {import('../../http/marketplace-request-signer.port.js').MarketplaceSignableRequest} request
     */
    async signedRequest(runtime, request) {
        const accessToken = await this.lwa.getAccessToken(runtime, this.deploymentLwaTokenUrl);
        const awsCredentials = readAmazonAwsCredentials(runtime.credentials);
        const awsRegion = resolveAmazonAwsRegion(runtime.configuration ?? {});
        const signer = new AwsSigV4RequestSigner({ region: awsRegion, service: 'execute-api' });
        const signed = await signer.sign({
            ...request,
            headers: {
                ...(request.headers ?? {}),
                'x-amz-access-token': accessToken,
            },
        }, {
            accessKeyId: awsCredentials.accessKeyId,
            secretAccessKey: awsCredentials.secretAccessKey,
            ...(awsCredentials.sessionToken === undefined ? {} : { sessionToken: awsCredentials.sessionToken }),
        });
        return this.http.request({
            url: signed.url,
            method: signed.method,
            headers: signed.headers,
            body: signed.body,
        });
    }
}
