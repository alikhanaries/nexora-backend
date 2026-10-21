import { BusinessRuleError, NotFoundError } from '../../../shared/errors/index.js';
import { isCommerceIntegrationUsable } from '../models/commerce-integration.js';
import { createPostgresCommerceIntegrationRepository } from '../repositories/postgres-commerce-integration-repository.js';
import { withChannelQueryable } from './resolve-commerce-integration-queryable.js';

export function createCommerceIntegrationQueryService(deps) {
    return {
        async getCommerceIntegrationById(tenantId, channelId, tx) {
            return withChannelQueryable(deps, tenantId, tx, async (queryable) => {
                const channel = await deps.getCommerceIntegrationById(tenantId, channelId, queryable);
                if (channel === null) {
                    throw new NotFoundError('Channel was not found', { tenantId, channelId });
                }
                return channel;
            });
        },
        async listCommerceIntegrations(tenantId, filters, tx) {
            return withChannelQueryable(deps, tenantId, tx, (queryable) =>
                deps.listCommerceIntegrations(tenantId, filters, queryable));
        },
        async verifyChannelBelongsToTenant(tenantId, channelId, tx) {
            return this.getCommerceIntegrationById(tenantId, channelId, tx);
        },
        async verifyChannelUsable(tenantId, channelId, tx) {
            const channel = await this.getCommerceIntegrationById(tenantId, channelId, tx);
            if (!isCommerceIntegrationUsable(channel)) {
                throw new BusinessRuleError('Channel is not usable', {
                    tenantId,
                    channelId,
                    status: channel.status,
                });
            }
            return channel;
        },
        async getCommerceIntegrationByExternalReference(tenantId, externalReference, tx) {
            const normalized = externalReference.trim();
            if (normalized.length === 0) {
                throw new NotFoundError('Channel was not found', { tenantId, externalReference });
            }
            return withChannelQueryable(deps, tenantId, tx, async (queryable) => {
                const channel = await deps.getCommerceIntegrationByExternalReference(tenantId, normalized, queryable);
                if (channel === null) {
                    throw new NotFoundError('Channel was not found', { tenantId, externalReference: normalized });
                }
                return channel;
            });
        },
    };
}

/**
 * @param {object} deps
 * @param {object} deps.database
 * @param {ReturnType<typeof createPostgresCommerceIntegrationRepository>} [deps.repository]
 */
export function createDefaultCommerceIntegrationQueryService(deps) {
    const repository = deps.repository ?? createPostgresCommerceIntegrationRepository();
    return createCommerceIntegrationQueryService({
        queryable: deps.database,
        database: deps.database,
        getCommerceIntegrationById: (tenantId, channelId, queryable) => repository.findById(queryable, tenantId, channelId),
        getCommerceIntegrationByExternalReference: (tenantId, externalReference, queryable) => repository.findByExternalReference(queryable, tenantId, externalReference),
        listCommerceIntegrations: (tenantId, filters, queryable) => repository.list(queryable, tenantId, filters),
    });
}
