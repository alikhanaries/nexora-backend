import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { applyMarketplaceSyncMappings } from '../../src/modules/channel-catalog-sync/application/apply-marketplace-sync-mappings.js';
import { AmazonCatalogAdapter } from '../../src/modules/marketplaces/infrastructure/adapters/amazon/amazon-catalog-adapter.js';
import { createMarketplaceEntityMappingRecorder } from '../../src/modules/marketplaces/application/create-marketplace-entity-mapping-recorder.js';
import { createApplication } from '../../src/app/bootstrap/create-application.js';
import { authHeaders, createAuthenticatedUser, createTestTenant } from './auth-helpers.js';
import { seedCommerceFixture } from './compatibility-helpers.js';
import { closeTestInfrastructure, getTestInfrastructure } from './helpers.js';

describe('Amazon catalog sync mapping persistence', () => {
    let app;
    let server;
    let database;

    beforeAll(async () => {
        const infra = await getTestInfrastructure();
        database = infra.database;
        app = await createApplication(infra);
        server = app.httpServer;
        await server.ready();
    });

    afterAll(async () => {
        await server?.close();
        await closeTestInfrastructure();
    });

    it('persists listing mapping hints from mocked Amazon inventory sync', async () => {
        const { tenantId, slug } = await createTestTenant(server);
        const user = await createAuthenticatedUser(app, tenantId, slug);
        const fixture = await seedCommerceFixture(server, authHeaders(user.accessToken));
        const patchListingItem = vi.fn(async () => ({ status: 200, json: {} }));
        const adapter = new AmazonCatalogAdapter({
            spApi: {
                getMarketplaceParticipations: vi.fn(),
                patchListingItem,
            },
        });
        const runtime = {
            marketplaceKey: 'amazon',
            connectionRequired: true,
            credentials: {
                clientId: 'client',
                clientSecret: 'secret',
                refreshToken: 'refresh',
                awsAccessKeyId: 'AKIA',
                awsSecretAccessKey: 'awssecret',
                sellerId: 'SELLER',
            },
            configuration: { marketplaceId: 'ATVPDKIKX0DER', region: 'na' },
        };
        const syncResult = await adapter.syncInventory({
            tenantId,
            channelId: fixture.channelId,
            marketplaceKey: 'amazon',
            productId: fixture.productId,
            externalCatalogIdentifier: 'AMZ-SKU-1',
            stockLocationId: fixture.stockLocationId,
            availableQuantity: 4,
            sourceEventId: 'evt-amz',
            correlationId: null,
        }, runtime);
        const recorder = createMarketplaceEntityMappingRecorder();
        await database.execute(async (tx) => {
            await applyMarketplaceSyncMappings(recorder, syncResult, {
                tenantId,
                channelId: fixture.channelId,
                marketplaceKey: 'amazon',
                tx,
            });
            const result = await tx.query(`SELECT external_entity_id FROM marketplace_entity_mappings
         WHERE tenant_id = $1 AND channel_id = $2 AND marketplace_key = 'amazon'
           AND nexora_entity_type = 'product' AND nexora_entity_id = $3`, [
                tenantId,
                fixture.channelId,
                fixture.productId,
            ]);
            expect(result.rows[0]?.external_entity_id).toBe('AMZ-SKU-1');
        }, { tenantId });
    });
});
