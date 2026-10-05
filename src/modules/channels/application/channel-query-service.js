import { BusinessRuleError, NotFoundError } from '../../../shared/errors/index.js';
import { withChannelQueryable } from './resolve-channel-queryable.js';
export class DefaultChannelQueryService {
    deps;
    constructor(deps) {
        this.deps = deps;
    }
    async getChannelById(tenantId, channelId, tx) {
        return withChannelQueryable(this.deps, tenantId, tx, async (queryable) => {
            const channel = await this.deps.getChannelById(tenantId, channelId, queryable);
            if (channel === null) {
                throw new NotFoundError('Channel was not found', { tenantId, channelId });
            }
            return channel;
        });
    }
    async listChannels(tenantId, filters, tx) {
        return withChannelQueryable(this.deps, tenantId, tx, (queryable) =>
            this.deps.listChannels(tenantId, filters, queryable));
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
        return withChannelQueryable(this.deps, tenantId, tx, async (queryable) => {
            const channel = await this.deps.getChannelByExternalReference(tenantId, normalized, queryable);
            if (channel === null) {
                throw new NotFoundError('Channel was not found', { tenantId, externalReference: normalized });
            }
            return channel;
        });
    }
}
