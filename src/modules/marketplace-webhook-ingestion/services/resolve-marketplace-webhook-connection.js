import { AuthenticationError } from '../../../shared/errors/index.js';
import { hashWebhookIngressToken } from './webhook-ingress-token.js';

/**
 * Resolves tenant/channel/marketplace from opaque ingress token (no tenant GUC).
 */
export class ResolveMarketplaceWebhookConnection {
    /** @param {import('../../../infrastructure/postgres/postgres-database.js').PostgresDatabase} database */
    database;

    constructor(database) {
        this.database = database;
    }

    /**
     * @param {string} ingressToken
     * @returns {Promise<{ connectionId: string, tenantId: string, channelId: string, marketplaceKey: string }>}
     */
    async execute(ingressToken) {
        const trimmed = ingressToken.trim();
        if (trimmed.length === 0) {
            throw new AuthenticationError('Marketplace webhook ingress token is required');
        }
        const tokenHash = hashWebhookIngressToken(trimmed);
        const result = await this.database.query(`SELECT id, tenant_id, channel_id, marketplace_key, status
       FROM app.lookup_marketplace_connection_for_webhook($1)`, [tokenHash], { operation: 'marketplace_webhook.lookup_connection' });
        const row = result.rows[0];
        if (row === undefined) {
            throw new AuthenticationError('Marketplace webhook ingress token is invalid');
        }
        return {
            connectionId: String(row['id']),
            tenantId: String(row['tenant_id']),
            channelId: String(row['channel_id']),
            marketplaceKey: String(row['marketplace_key']),
        };
    }
}
