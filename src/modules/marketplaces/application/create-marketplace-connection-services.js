import { DefaultAuthorizationService } from '../../authorization/public/index.js';
import { createMarketplaceAdapterRegistry } from './create-marketplace-adapter-registry.js';
import { MarketplaceConnectionCommandService } from './marketplace-connection-command-service.js';
import { MarketplaceConnectionQueryService } from './marketplace-connection-query-service.js';
import { PostgresMarketplaceConnectionRepository } from '../infrastructure/postgres-marketplace-connection-repository.js';
import { PostgresMarketplaceRepository } from '../infrastructure/postgres-marketplace-repository.js';

/**
 * @param {object} deps
 * @param {object} deps.queryable
 * @param {import('../../shared/security/secret-encryptor.port.js').SecretEncryptorPort} deps.secretEncryptor
 * @param {import('../../channels/public/index.js').DefaultChannelQueryService} deps.channelQueryService
 */
export function createMarketplaceConnectionServices(deps) {
    const authorization = new DefaultAuthorizationService();
    const connections = new PostgresMarketplaceConnectionRepository();
    const marketplaces = new PostgresMarketplaceRepository();
    const adapterRegistry = createMarketplaceAdapterRegistry();
    const shared = {
        authorization,
        connections,
        marketplaces,
        secretEncryptor: deps.secretEncryptor,
        adapterRegistry,
        queryable: deps.queryable,
        channelQueryService: deps.channelQueryService,
    };
    const commandService = new MarketplaceConnectionCommandService(shared);
    const queryService = new MarketplaceConnectionQueryService({
        authorization,
        connections,
        channelQueryService: deps.channelQueryService,
        queryable: deps.queryable,
    });
    return { commandService, queryService };
}
