import { BusinessRuleError, NotFoundError } from '../../../shared/errors/index.js';
import { withChannelQueryable } from './resolve-commerce-integration-queryable.js';
export class CommerceIntegrationQueryService {
    deps;
    constructor(deps) {
        this.deps = deps;
    }
    async getCommerceIntegrationById(tenantId, channelId, tx) {
        return withChannelQueryable(this.deps, tenantId, tx, async (queryable) => {
            const channel = await this.deps.getCommerceIntegrationById(tenantId, channelId, queryable);
            if (channel === null) {
                throw new NotFoundError('Channel was not found', { tenantId, channelId });
            }
            return channel;
        });
    }
    async listCommerceIntegrations(tenantId, filters, tx) {
        return withChannelQueryable(this.deps, tenantId, tx, (queryable) =>
            this.deps.listCommerceIntegrations(tenantId, filters, queryable));
    }
    async verifyChannelBelongsToTenant(tenantId, channelId, tx) {
        return this.getCommerceIntegrationById(tenantId, channelId, tx);
    }
    async verifyChannelUsable(tenantId, channelId, tx) {
        const channel = await this.getCommerceIntegrationById(tenantId, channelId, tx);
        if (!channel.isUsable()) {
            throw new BusinessRuleError('Channel is not usable', {
                tenantId,
                channelId,
                status: channel.status,
            });
        }
        return channel;
    }
    async getCommerceIntegrationByExternalReference(tenantId, externalReference, tx) {
        const normalized = externalReference.trim();
        if (normalized.length === 0) {
            throw new NotFoundError('Channel was not found', { tenantId, externalReference });
        }
        return withChannelQueryable(this.deps, tenantId, tx, async (queryable) => {
            const channel = await this.deps.getCommerceIntegrationByExternalReference(tenantId, normalized, queryable);
            if (channel === null) {
                throw new NotFoundError('Channel was not found', { tenantId, externalReference: normalized });
            }
            return channel;
        });
    }
}
