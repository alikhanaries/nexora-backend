import { randomUUID } from 'node:crypto';
import { NotFoundError, ValidationError } from '../../../shared/errors/index.js';
import { UnsupportedMarketplaceAdapterError } from '../../channel-catalog-sync/public/catalog-sync-errors.js';
import { toMarketplaceConnectionDto } from './marketplace-connection-dto.js';

export class MarketplaceConnectionCommandService {
    deps;

    /**
     * @param {object} deps
     * @param {import('../../authorization/public/index.js').DefaultAuthorizationService} deps.authorization
     * @param {import('../infrastructure/postgres-marketplace-connection-repository.js').PostgresMarketplaceConnectionRepository} deps.connections
     * @param {import('../../channels/public/index.js').DefaultChannelQueryService} deps.channelQueryService
     * @param {import('../infrastructure/postgres-marketplace-repository.js').PostgresMarketplaceRepository} deps.marketplaces
     * @param {import('../../shared/security/secret-encryptor.port.js').SecretEncryptorPort} deps.secretEncryptor
     * @param {import('../../channel-catalog-sync/public/marketplace-catalog-adapter-registry.js').MarketplaceCatalogAdapterRegistry} deps.adapterRegistry
     * @param {object} deps.queryable
     */
    constructor(deps) {
        this.deps = deps;
    }

    async upsertMarketplaceConnection(input) {
        this.deps.authorization.requirePermission(input.actorPermissions, 'channels.update');
        assertCredentialsObject(input.credentials);
        return this.deps.queryable.execute(async (tx) => {
            const channel = await this.deps.channelQueryService.getChannelById(
                input.tenantId,
                input.channelId,
                tx,
            );
            const marketplace = await this.deps.marketplaces.findById(tx, channel.marketplaceId);
            if (marketplace === null) {
                throw new NotFoundError('Marketplace was not found', {
                    marketplaceId: channel.marketplaceId,
                });
            }
            const marketplaceKey = marketplace.key;
            const credentialsCiphertext = this.deps.secretEncryptor.encrypt(JSON.stringify(input.credentials));
            const id = randomUUID();
            await this.deps.connections.upsertActive(tx, {
                id,
                tenantId: input.tenantId,
                channelId: input.channelId,
                marketplaceKey,
                credentialsCiphertext,
                configuration: input.configuration ?? {},
            });
            const row = await this.deps.connections.findActiveByChannel(tx, input.tenantId, input.channelId);
            if (row === null) {
                throw new ValidationError('Marketplace connection could not be persisted');
            }
            return { connection: toMarketplaceConnectionDto(row) };
        }, { tenantId: input.tenantId });
    }

    async patchMarketplaceConnection(input) {
        this.deps.authorization.requirePermission(input.actorPermissions, 'channels.update');
        const existing = await this.getActiveRowOrThrow(input.tenantId, input.channelId);
        const credentials = input.credentials === undefined
            ? undefined
            : (assertCredentialsObject(input.credentials), input.credentials);
        const configuration = input.configuration === undefined
            ? existing.configuration
            : { ...existing.configuration, ...input.configuration };
        const credentialsCiphertext = credentials === undefined
            ? existing.credentials_ciphertext
            : this.deps.secretEncryptor.encrypt(JSON.stringify(credentials));
        return this.deps.queryable.execute(async (tx) => {
            await this.deps.connections.upsertActive(tx, {
                id: randomUUID(),
                tenantId: input.tenantId,
                channelId: input.channelId,
                marketplaceKey: existing.marketplace_key,
                credentialsCiphertext,
                configuration,
            });
            const row = await this.deps.connections.findActiveByChannel(tx, input.tenantId, input.channelId);
            if (row === null) {
                throw new ValidationError('Marketplace connection could not be updated');
            }
            return { connection: toMarketplaceConnectionDto(row) };
        }, { tenantId: input.tenantId });
    }

    async deleteMarketplaceConnection(input) {
        this.deps.authorization.requirePermission(input.actorPermissions, 'channels.update');
        await this.getActiveRowOrThrow(input.tenantId, input.channelId);
        await this.deps.queryable.execute(async (tx) => {
            await this.deps.connections.disableByChannel(tx, input.tenantId, input.channelId);
        }, { tenantId: input.tenantId });
        return { success: true };
    }

    async testMarketplaceConnection(input) {
        this.deps.authorization.requirePermission(input.actorPermissions, 'channels.update');
        const row = await this.getActiveRowOrThrow(input.tenantId, input.channelId);
        const credentials = JSON.parse(this.deps.secretEncryptor.decrypt(row.credentials_ciphertext));
        let adapter;
        try {
            adapter = this.deps.adapterRegistry.resolve(row.marketplace_key);
        }
        catch (error) {
            if (error instanceof UnsupportedMarketplaceAdapterError) {
                throw new ValidationError('No marketplace adapter is registered for this channel marketplace');
            }
            throw error;
        }
        if (typeof adapter.testConnection !== 'function') {
            throw new ValidationError('Marketplace adapter does not support connection tests');
        }
        const runtime = {
            marketplaceKey: row.marketplace_key,
            configuration: row.configuration ?? {},
            credentials,
            connectionRequired: true,
        };
        await adapter.testConnection(runtime);
        return { success: true };
    }

    /**
     * @param {string} tenantId
     * @param {string} channelId
     */
    async getActiveRowOrThrow(tenantId, channelId) {
        return this.deps.queryable.execute(async (tx) => {
            await this.deps.channelQueryService.getChannelById(tenantId, channelId, tx);
            const row = await this.deps.connections.findActiveByChannel(tx, tenantId, channelId);
            if (row === null) {
                throw new NotFoundError('Marketplace connection was not found', { channelId });
            }
            return row;
        }, { tenantId });
    }
}

/**
 * @param {unknown} credentials
 */
function assertCredentialsObject(credentials) {
    if (credentials === null || typeof credentials !== 'object' || Array.isArray(credentials)) {
        throw new ValidationError('Marketplace connection credentials must be a JSON object');
    }
    return credentials;
}
