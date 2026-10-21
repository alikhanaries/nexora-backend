import { createDefaultAuthorizationService } from '../../authorization/public/index.js';
import { createMarketplaceAdapterRegistry } from './create-marketplace-adapter-registry.js';
import { MarketplaceConnectionCommandService } from './marketplace-connection-command-service.js';
import { MarketplaceConnectionQueryService } from './marketplace-connection-query-service.js';
import { PostgresMarketplaceConnectionRepository } from '../repositories/postgres-marketplace-connection-repository.js';
import { PostgresMarketplaceRepository } from '../repositories/postgres-marketplace-repository.js';

/**
 * @param {object} deps
 * @param {object} deps.queryable
 * @param {import('../../shared/security/secret-encryptor.port.js').SecretEncryptorPort} deps.secretEncryptor
 * @param {import('../../commerce-integrations/public/index.js').CommerceIntegrationQueryService} deps.commerceIntegrationQueryService
 * @param {import('../../audit/public/index.js').AuditRecorderPort} [deps.auditRecorder]
 * @param {string | null | undefined} [deps.amazonLwaTokenUrl]
 * @param {string | null | undefined} [deps.noonApiBaseUrl]
 * @param {string | null | undefined} [deps.noonUserAgent]
 */
export function createMarketplaceConnectionServices(deps) {
    const authorization = createDefaultAuthorizationService();
    const connections = new PostgresMarketplaceConnectionRepository();
    const marketplaces = new PostgresMarketplaceRepository();
    const adapterRegistry = createMarketplaceAdapterRegistry({
        amazonLwaTokenUrl: deps.amazonLwaTokenUrl,
        noonApiBaseUrl: deps.noonApiBaseUrl,
        noonUserAgent: deps.noonUserAgent,
    });
    const shared = {
        authorization,
        connections,
        marketplaces,
        secretEncryptor: deps.secretEncryptor,
        adapterRegistry,
        queryable: deps.queryable,
        commerceIntegrationQueryService: deps.commerceIntegrationQueryService,
        ...(deps.auditRecorder === undefined ? {} : { auditRecorder: deps.auditRecorder }),
    };
    const commandService = new MarketplaceConnectionCommandService(shared);
    const queryService = new MarketplaceConnectionQueryService({
        authorization,
        connections,
        commerceIntegrationQueryService: deps.commerceIntegrationQueryService,
        queryable: deps.queryable,
    });
    return { commandService, queryService };
}
