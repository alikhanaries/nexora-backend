import { randomUUID } from 'node:crypto';
import { NotFoundError, ValidationError } from '../../../shared/errors/index.js';
import { auditRequestFields } from '../../audit/public/index.js';
import { UnsupportedMarketplaceAdapterError } from '../../channel-catalog-sync/public/catalog-sync-errors.js';
import { MarketplaceConnectionTestOutcome } from '../domain/marketplace-connection-test-outcome.js';
import { sanitizeMarketplaceConnectionTestError } from './sanitize-marketplace-connection-test-error.js';
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
     * @param {import('../../audit/public/index.js').AuditRecorderPort} [deps.auditRecorder]
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
            await this.recordAudit(tx, {
                tenantId: input.tenantId,
                actorId: input.actorId,
                eventType: 'MARKETPLACE_CONNECTION_CREATED',
                resourceId: row.id,
                metadata: {
                    channelId: input.channelId,
                    marketplaceKey,
                },
            });
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
            await this.recordAudit(tx, {
                tenantId: input.tenantId,
                actorId: input.actorId,
                eventType: 'MARKETPLACE_CONNECTION_UPDATED',
                resourceId: row.id,
                metadata: {
                    channelId: input.channelId,
                    marketplaceKey: row.marketplace_key,
                    credentialsRotated: credentials !== undefined,
                },
            });
            return { connection: toMarketplaceConnectionDto(row) };
        }, { tenantId: input.tenantId });
    }

    async deleteMarketplaceConnection(input) {
        this.deps.authorization.requirePermission(input.actorPermissions, 'channels.update');
        const existing = await this.getActiveRowOrThrow(input.tenantId, input.channelId);
        await this.deps.queryable.execute(async (tx) => {
            await this.deps.connections.disableByChannel(tx, input.tenantId, input.channelId);
            await this.recordAudit(tx, {
                tenantId: input.tenantId,
                actorId: input.actorId,
                eventType: 'MARKETPLACE_CONNECTION_DISABLED',
                resourceId: existing.id,
                metadata: {
                    channelId: input.channelId,
                    marketplaceKey: existing.marketplace_key,
                },
            });
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
        try {
            await adapter.testConnection(runtime);
            await this.deps.queryable.execute(async (tx) => {
                await this.deps.connections.recordConnectionTest(tx, {
                    tenantId: input.tenantId,
                    channelId: input.channelId,
                    connectionId: row.id,
                    outcome: MarketplaceConnectionTestOutcome.SUCCESS,
                    errorMessage: null,
                });
                await this.recordAudit(tx, {
                    tenantId: input.tenantId,
                    actorId: input.actorId,
                    eventType: 'MARKETPLACE_CONNECTION_TESTED',
                    resourceId: row.id,
                    metadata: {
                        channelId: input.channelId,
                        marketplaceKey: row.marketplace_key,
                        outcome: MarketplaceConnectionTestOutcome.SUCCESS,
                    },
                });
            }, { tenantId: input.tenantId });
            return { success: true };
        }
        catch (error) {
            const sanitized = sanitizeMarketplaceConnectionTestError(error);
            await this.deps.queryable.execute(async (tx) => {
                await this.deps.connections.recordConnectionTest(tx, {
                    tenantId: input.tenantId,
                    channelId: input.channelId,
                    connectionId: row.id,
                    outcome: MarketplaceConnectionTestOutcome.FAILURE,
                    errorMessage: sanitized,
                });
                await this.recordAudit(tx, {
                    tenantId: input.tenantId,
                    actorId: input.actorId,
                    eventType: 'MARKETPLACE_CONNECTION_TESTED',
                    resourceId: row.id,
                    metadata: {
                        channelId: input.channelId,
                        marketplaceKey: row.marketplace_key,
                        outcome: MarketplaceConnectionTestOutcome.FAILURE,
                        error: sanitized,
                    },
                });
            }, { tenantId: input.tenantId });
            throw error;
        }
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

    /**
     * @param {object} tx
     * @param {object} event
     */
    async recordAudit(tx, event) {
        if (this.deps.auditRecorder === undefined) {
            return;
        }
        await this.deps.auditRecorder.record(tx, {
            tenantId: event.tenantId,
            actorKind: 'user',
            actorId: event.actorId ?? event.tenantId,
            eventType: event.eventType,
            resourceType: 'marketplace_connection',
            resourceId: event.resourceId,
            metadata: event.metadata,
            ...auditRequestFields(),
        });
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
