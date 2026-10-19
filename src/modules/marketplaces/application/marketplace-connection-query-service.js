import { NotFoundError } from '../../../shared/errors/index.js';
import { toMarketplaceConnectionDto } from './marketplace-connection-dto.js';

export class MarketplaceConnectionQueryService {
    deps;

    /**
     * @param {object} deps
     * @param {import('../../authorization/public/index.js').DefaultAuthorizationService} deps.authorization
     * @param {import('../infrastructure/postgres-marketplace-connection-repository.js').PostgresMarketplaceConnectionRepository} deps.connections
     * @param {import('../../commerce-integrations/public/index.js').CommerceIntegrationQueryService} deps.commerceIntegrationQueryService
     * @param {object} deps.queryable
     */
    constructor(deps) {
        this.deps = deps;
    }

    async getMarketplaceConnection(input) {
        this.deps.authorization.requirePermission(input.actorPermissions, 'channels.read');
        return this.deps.queryable.execute(async (tx) => {
            const channel = await this.deps.commerceIntegrationQueryService.getCommerceIntegrationById(
                input.tenantId,
                input.channelId,
                tx,
            );
            if (channel.tenantId !== input.tenantId) {
                throw new NotFoundError('Channel was not found', {
                    tenantId: input.tenantId,
                    channelId: input.channelId,
                });
            }
            const row = await this.deps.connections.findByChannel(tx, input.tenantId, input.channelId);
            if (row === null || row.status !== 'ACTIVE') {
                throw new NotFoundError('Marketplace connection was not found', {
                    channelId: input.channelId,
                });
            }
            return { connection: toMarketplaceConnectionDto(row) };
        }, { tenantId: input.tenantId });
    }
}
