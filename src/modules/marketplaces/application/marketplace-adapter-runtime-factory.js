import { FOUNDATION_STUB_MARKETPLACE_KEY } from '../../channel-catalog-sync/public/marketplace-catalog-adapter.port.js';
import { CatalogSyncPermanentError } from '../../channel-catalog-sync/public/catalog-sync-errors.js';

export class MarketplaceAdapterRuntimeFactory {
    deps;

    /**
     * @param {object} deps
     * @param {import('../infrastructure/postgres-marketplace-connection-repository.js').PostgresMarketplaceConnectionRepository} deps.connections
     * @param {import('../../shared/security/secret-encryptor.port.js').SecretEncryptorPort} deps.secretEncryptor
     * @param {object} deps.queryable
     * @param {string | null | undefined} [deps.shopifyAdminApiVersion]
     */
    constructor(deps) {
        this.deps = deps;
    }

    /**
     * @param {object} input
     * @param {string} input.tenantId
     * @param {string} input.channelId
     * @param {string} input.marketplaceKey
     * @param {object} [input.tx]
     */
    async createForSync(input) {
        if (input.marketplaceKey === FOUNDATION_STUB_MARKETPLACE_KEY) {
            return {
                marketplaceKey: input.marketplaceKey,
                configuration: {},
                credentials: {},
                connectionRequired: false,
            };
        }
        const queryable = input.tx ?? this.deps.queryable;
        const row = await this.deps.connections.findActiveByChannel(
            queryable,
            input.tenantId,
            input.channelId,
        );
        if (row === null) {
            throw new CatalogSyncPermanentError('Active marketplace connection was not found for channel', {
                tenantId: input.tenantId,
                channelId: input.channelId,
            });
        }
        if (row.marketplace_key !== input.marketplaceKey) {
            throw new CatalogSyncPermanentError('Marketplace connection key does not match channel marketplace', {
                marketplaceKey: input.marketplaceKey,
            });
        }
        const credentialsJson = this.deps.secretEncryptor.decrypt(row.credentials_ciphertext);
        const credentials = JSON.parse(credentialsJson);
        const configuration = applyDeploymentMarketplaceDefaults(
            row.marketplace_key,
            row.configuration ?? {},
            this.deps.shopifyAdminApiVersion,
        );
        return {
            marketplaceKey: row.marketplace_key,
            configuration,
            credentials,
            connectionRequired: true,
        };
    }
}

/**
 * @param {string} marketplaceKey
 * @param {Record<string, unknown>} configuration
 * @param {string | null | undefined} shopifyAdminApiVersion
 */
function applyDeploymentMarketplaceDefaults(marketplaceKey, configuration, shopifyAdminApiVersion) {
    if (marketplaceKey !== 'shopify') {
        return configuration;
    }
    if (typeof configuration.apiVersion === 'string' && configuration.apiVersion.trim().length > 0) {
        return configuration;
    }
    if (typeof shopifyAdminApiVersion !== 'string' || shopifyAdminApiVersion.trim().length === 0) {
        return configuration;
    }
    return { ...configuration, apiVersion: shopifyAdminApiVersion.trim() };
}
