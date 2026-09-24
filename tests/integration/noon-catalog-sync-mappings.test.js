import { generateKeyPairSync } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { applyMarketplaceSyncMappings } from '../../src/modules/channel-catalog-sync/application/apply-marketplace-sync-mappings.js';
import { NoonCatalogAdapter } from '../../src/modules/marketplaces/infrastructure/adapters/noon/noon-catalog-adapter.js';
import { createMarketplaceEntityMappingRecorder } from '../../src/modules/marketplaces/application/create-marketplace-entity-mapping-recorder.js';
import { createApplication } from '../../src/app/bootstrap/create-application.js';
import { authHeaders, createAuthenticatedUser, createTestTenant } from './auth-helpers.js';
import { seedCommerceFixture } from './compatibility-helpers.js';
import { closeTestInfrastructure, getTestInfrastructure } from './helpers.js';

const { privateKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });
const privateKeyPem = privateKey.export({ type: 'pkcs8', format: 'pem' }).toString();

describe('Noon catalog sync mapping persistence', () => {
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

    it('persists partner SKU mapping hints from mocked Noon inventory sync', async () => {
        const { tenantId, slug } = await createTestTenant(server);
        const user = await createAuthenticatedUser(app, tenantId, slug);
        const fixture = await seedCommerceFixture(server, authHeaders(user.accessToken));
        const updateStock = vi.fn(async () => ({
            json: { items: [{ status: { status_id: 0, status_code: 'OK', message: '' } }] },
        }));
        const adapter = new NoonCatalogAdapter({
            api: {
                whoami: vi.fn(),
                updateStock,
                upsertPricing: vi.fn(),
                setOfferActive: vi.fn(),
                getProductOffers: vi.fn(),
            },
        });
        const runtime = {
            marketplaceKey: 'noon',
            connectionRequired: true,
            credentials: {
                keyId: 'test-key',
                privateKey: privateKeyPem,
                projectCode: 'PRJ',
            },
            configuration: { countryCode: 'ae', warehouseCode: 'WH-1' },
        };
        const syncResult = await adapter.syncInventory({
            tenantId,
            channelId: fixture.channelId,
            marketplaceKey: 'noon',
            productId: fixture.productId,
            externalCatalogIdentifier: 'NOON-SKU-1',
            stockLocationId: fixture.stockLocationId,
            availableQuantity: 4,
            sourceEventId: 'evt-noon',
            correlationId: null,
        }, runtime);
        const recorder = createMarketplaceEntityMappingRecorder();
        await database.execute(async (tx) => {
            await applyMarketplaceSyncMappings(recorder, syncResult, {
                tenantId,
                channelId: fixture.channelId,
                marketplaceKey: 'noon',
                tx,
            });
            const result = await tx.query(`SELECT external_entity_id FROM marketplace_entity_mappings
         WHERE tenant_id = $1 AND channel_id = $2 AND marketplace_key = 'noon'
           AND nexora_entity_type = 'product' AND nexora_entity_id = $3`, [
                tenantId,
                fixture.channelId,
                fixture.productId,
            ]);
            expect(result.rows[0]?.external_entity_id).toBe('NOON-SKU-1');
        }, { tenantId });
    });
});
