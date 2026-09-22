import { BusinessRuleError, NotFoundError } from '../../../shared/errors/index.js';
export class DefaultChannelQueryService {
    deps;
    constructor(deps) {
        this.deps = deps;
    }
    async getChannelById(tenantId, channelId, tx) {
        const queryable = tx ?? this.deps.queryable;
        const channel = await this.deps.getChannelById(tenantId, channelId, queryable);
        if (channel === null) {
            throw new NotFoundError('Channel was not found', { tenantId, channelId });
        }
        return channel;
    }
    async listChannels(tenantId, filters, tx) {
        const queryable = tx ?? this.deps.queryable;
        return this.deps.listChannels(tenantId, filters, queryable);
    }
    async verifyChannelBelongsToTenant(tenantId, channelId, tx) {
        return this.getChannelById(tenantId, channelId, tx);
    }
    async verifyChannelUsable(tenantId, channelId, tx) {
        const channel = await this.getChannelById(tenantId, channelId, tx);
        if (!channel.isUsable()) {
            throw new BusinessRuleError('Channel is not usable', {
                tenantId,
                channelId,
                status: channel.status,
            });
        }
        return channel;
    }
    async getChannelByExternalReference(tenantId, externalReference, tx) {
        const normalized = externalReference.trim();
        if (normalized.length === 0) {
            throw new NotFoundError('Channel was not found', { tenantId, externalReference });
        }
        const queryable = tx ?? this.deps.queryable;
        const channel = await this.deps.getChannelByExternalReference(tenantId, normalized, queryable);
        if (channel === null) {
            throw new NotFoundError('Channel was not found', { tenantId, externalReference: normalized });
        }
        return channel;
    }
}
