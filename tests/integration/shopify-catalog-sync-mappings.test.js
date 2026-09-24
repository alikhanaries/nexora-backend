import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { applyMarketplaceSyncMappings } from '../../src/modules/channel-catalog-sync/application/apply-marketplace-sync-mappings.js';
import { ShopifyCatalogAdapter } from '../../src/modules/marketplaces/infrastructure/adapters/shopify/shopify-catalog-adapter.js';
import { ShopifyGraphqlClient } from '../../src/modules/marketplaces/infrastructure/adapters/shopify/shopify-graphql-client.js';
import { createMarketplaceEntityMappingRecorder } from '../../src/modules/marketplaces/application/create-marketplace-entity-mapping-recorder.js';
import { MarketplaceHttpClient } from '../../src/modules/marketplaces/infrastructure/http/marketplace-http-client.js';
import { createApplication } from '../../src/app/bootstrap/create-application.js';
import { authHeaders, createAuthenticatedUser, createTestTenant } from './auth-helpers.js';
import { seedCommerceFixture } from './compatibility-helpers.js';
import { closeTestInfrastructure, getTestInfrastructure } from './helpers.js';

describe('Shopify catalog sync mapping persistence', () => {
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

    it('persists mapping hints from Shopify syncInventory through generic recorder', async () => {
        const { tenantId, slug } = await createTestTenant(server);
        const user = await createAuthenticatedUser(app, tenantId, slug);
        const fixture = await seedCommerceFixture(server, authHeaders(user.accessToken));
        const fetchImpl = vi.fn()
            .mockResolvedValueOnce(new Response(JSON.stringify({
                data: { productVariant: { inventoryItem: { id: 'gid://shopify/InventoryItem/77' } } },
            }), { status: 200 }))
            .mockResolvedValueOnce(new Response(JSON.stringify({
                data: { inventorySetQuantities: { userErrors: [] } },
            }), { status: 200 }));
        const adapter = new ShopifyCatalogAdapter({
            graphql: new ShopifyGraphqlClient({ http: new MarketplaceHttpClient({ fetchImpl }) }),
        });
        const runtime = {
            marketplaceKey: 'shopify',
            connectionRequired: true,
            credentials: { shopDomain: 'shop.myshopify.com', accessToken: 'token' },
            configuration: { shopifyLocationId: '1' },
        };
        const syncResult = await adapter.syncInventory({
            tenantId,
            channelId: fixture.channelId,
            marketplaceKey: 'shopify',
            productId: fixture.productId,
            externalCatalogIdentifier: '1001',
            stockLocationId: fixture.stockLocationId,
            availableQuantity: 3,
            sourceEventId: 'evt-shopify-map',
            correlationId: null,
        }, runtime);
        const recorder = createMarketplaceEntityMappingRecorder();
        await database.execute(async (tx) => {
            await applyMarketplaceSyncMappings(recorder, syncResult, {
                tenantId,
                channelId: fixture.channelId,
                marketplaceKey: 'shopify',
                tx,
            });
            const result = await tx.query(`SELECT external_entity_id FROM marketplace_entity_mappings
         WHERE tenant_id = $1 AND channel_id = $2 AND marketplace_key = 'shopify'
           AND nexora_entity_type = 'product' AND nexora_entity_id = $3`, [
                tenantId,
                fixture.channelId,
                fixture.productId,
            ]);
            expect(result.rows[0]?.external_entity_id).toBe('gid://shopify/InventoryItem/77');
        }, { tenantId });
    });
});
