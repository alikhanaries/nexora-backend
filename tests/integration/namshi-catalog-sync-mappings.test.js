import { generateKeyPairSync } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { applyMarketplaceSyncMappings } from '../../src/modules/channel-catalog-sync/application/apply-marketplace-sync-mappings.js';
import { NamshiCatalogAdapter } from '../../src/modules/marketplaces/infrastructure/adapters/namshi/namshi-catalog-adapter.js';
import { createMarketplaceEntityMappingRecorder } from '../../src/modules/marketplaces/application/create-marketplace-entity-mapping-recorder.js';
import { createApplication } from '../../src/app/bootstrap/create-application.js';
import { authHeaders, createAuthenticatedUser, createTestTenant } from './auth-helpers.js';
import { seedCommerceFixture } from './compatibility-helpers.js';
import { closeTestInfrastructure, getTestInfrastructure } from './helpers.js';

const { privateKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });
const privateKeyPem = privateKey.export({ type: 'pkcs8', format: 'pem' }).toString();

describe('Namshi catalog sync mapping persistence', () => {
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

    it('persists partner SKU mapping hints from mocked Namshi inventory sync', async () => {
        const { tenantId, slug } = await createTestTenant(server);
        const user = await createAuthenticatedUser(app, tenantId, slug);
        const fixture = await seedCommerceFixture(server, authHeaders(user.accessToken));
        const updateStock = vi.fn(async () => ({
            json: { items: [{ status: { status_id: 0, status_code: 'OK', message: '' } }] },
        }));
        const adapter = new NamshiCatalogAdapter({
            api: {
                whoami: vi.fn(),
                updateStock,
                upsertLocalPricing: vi.fn(),
                getProductOffers: vi.fn(),
            },
        });
        const runtime = {
            marketplaceKey: 'namshi',
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
            marketplaceKey: 'namshi',
            productId: fixture.productId,
            externalCatalogIdentifier: 'NAMSHI-SKU-1',
            stockLocationId: fixture.stockLocationId,
            availableQuantity: 2,
            sourceEventId: 'evt-namshi',
            correlationId: null,
        }, runtime);
        const recorder = createMarketplaceEntityMappingRecorder();
        await database.execute(async (tx) => {
            await applyMarketplaceSyncMappings(recorder, syncResult, {
                tenantId,
                channelId: fixture.channelId,
                marketplaceKey: 'namshi',
                tx,
            });
            const result = await tx.query(`SELECT external_entity_id FROM marketplace_entity_mappings
         WHERE tenant_id = $1 AND channel_id = $2 AND marketplace_key = 'namshi'
           AND nexora_entity_type = 'product' AND nexora_entity_id = $3`, [
                tenantId,
                fixture.channelId,
                fixture.productId,
            ]);
            expect(result.rows[0]?.external_entity_id).toBe('NAMSHI-SKU-1');
        }, { tenantId });
    });
});
