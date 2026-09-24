import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { createApplication } from '../../src/app/bootstrap/create-application.js';
import { createExternalIdMappingModule } from '../../src/modules/external-id-mapping/index.js';
import { BackfillExternalIntegerIdMappings } from '../../src/modules/external-id-mapping/application/backfill-external-integer-id-mappings.js';
import { PostgresExternalIdBackfillQueries } from '../../src/modules/external-id-mapping/infrastructure/postgres-external-id-backfill-queries.js';
import {
    ExternalIdMappingProvider,
    ExternalIdMappingResourceType,
} from '../../src/modules/external-id-mapping/public/index.js';
import {
    authHeaders,
    createAuthenticatedUser,
    createTestTenant,
} from './auth-helpers.js';
import {
    acknowledgeHeaders,
    acknowledgePayload,
    cancellationHeaders,
    cancellationPayload,
    createOrder,
    seedCommerceFixture,
    setOrderStatus,
    shipmentHeaders,
    shipmentPayload,
    returnHeaders,
    returnPayload,
} from './compatibility-helpers.js';
import { closeTestInfrastructure, getTestInfrastructure } from './helpers.js';

async function deleteMappingsForResources(database, tenantId, resourceIds) {
    if (resourceIds.length === 0) {
        return;
    }
    await database.query(
        `DELETE FROM external_integer_id_mappings
     WHERE tenant_id = $1 AND resource_id = ANY($2::uuid[])`,
        [tenantId, resourceIds],
        { operation: 'test.delete_external_id_mappings' },
    );
}

async function findExternalId(queryService, tenantId, resourceType, resourceId) {
    return queryService.findExternalIdByResourceId(
        tenantId,
        ExternalIdMappingProvider.COMPAT_V2,
        resourceType,
        resourceId,
    );
}

async function countMappingsForType(database, tenantId, resourceType) {
    const result = await database.query(
        `SELECT COUNT(*)::int AS count
     FROM external_integer_id_mappings
     WHERE tenant_id = $1 AND provider = $2 AND resource_type = $3`,
        [tenantId, ExternalIdMappingProvider.COMPAT_V2, resourceType],
        { operation: 'test.count_external_id_mappings_by_type' },
    );
    return result.rows[0]?.count ?? 0;
}

async function findShipmentId(database, tenantId, orderId) {
    const result = await database.query(
        `SELECT id FROM shipments WHERE tenant_id = $1 AND order_id = $2 LIMIT 1`,
        [tenantId, orderId],
        { operation: 'test.find_shipment_for_order' },
    );
    return result.rows[0]?.id ?? null;
}

async function findCancellationId(database, tenantId, orderId) {
    const result = await database.query(
        `SELECT id FROM cancellations WHERE tenant_id = $1 AND order_id = $2 LIMIT 1`,
        [tenantId, orderId],
        { operation: 'test.find_cancellation_for_order' },
    );
    return result.rows[0]?.id ?? null;
}

async function findReturnId(database, tenantId, merchantReturnNo) {
    const result = await database.query(
        `SELECT id FROM returns WHERE tenant_id = $1 AND external_reference = $2 LIMIT 1`,
        [tenantId, merchantReturnNo],
        { operation: 'test.find_return_by_reference' },
    );
    return result.rows[0]?.id ?? null;
}

function createBackfillService(infra, overrides = {}) {
    const module = createExternalIdMappingModule({ database: infra.database, logger: infra.logger });
    const silentLogger = { info() {}, warn() {}, error() {}, debug() {}, child: () => silentLogger };
    return new BackfillExternalIntegerIdMappings({
        database: infra.database,
        externalIntegerIdMappingCommandService:
            overrides.commandService ?? module.externalIntegerIdMappingCommandService,
        backfillQueries: new PostgresExternalIdBackfillQueries(),
        logger: silentLogger,
    });
}

describe('external integer ID historical backfill', () => {
    let infra;
    let app;
    let server;
    /** @type {import('../../src/modules/external-id-mapping/public/external-integer-id-mapping-query-service.js').ExternalIntegerIdMappingQueryService} */
    let queryService;

    beforeAll(async () => {
        infra = await getTestInfrastructure();
        app = await createApplication(infra);
        server = app.httpServer;
        await server.ready();
        queryService = createExternalIdMappingModule({ database: infra.database })
            .externalIntegerIdMappingQueryService;
    });

    afterAll(async () => {
        await server?.close();
        await closeTestInfrastructure();
    });

    it('creates mappings for historical orders and order lines', async () => {
        const { tenantId, slug } = await createTestTenant(server);
        const user = await createAuthenticatedUser(app, tenantId, slug);
        const headers = authHeaders(user.accessToken);
        const fixture = await seedCommerceFixture(server, headers);
        const order = await createOrder(server, headers, fixture, `backfill-hist-${Date.now()}`, 2);
        const lineIds = order.lines.map((line) => line.id);
        await deleteMappingsForResources(infra.database, tenantId, [order.id, ...lineIds]);

        const backfill = createBackfillService(infra);
        const result = await backfill.run({ tenantIds: [tenantId], batchSize: 10 });
        const orderStats = result.tenants[0]?.resourceTypes.find(
            (entry) => entry.resourceType === ExternalIdMappingResourceType.ORDER,
        );
        const lineStats = result.tenants[0]?.resourceTypes.find(
            (entry) => entry.resourceType === ExternalIdMappingResourceType.ORDER_LINE,
        );
        expect(orderStats?.assigned).toBeGreaterThanOrEqual(1);
        expect(lineStats?.assigned).toBeGreaterThanOrEqual(lineIds.length);

        const orderExternalId = await findExternalId(queryService, tenantId, ExternalIdMappingResourceType.ORDER, order.id);
        expect(orderExternalId).toBeGreaterThan(0);
        for (const lineId of lineIds) {
            const lineExternalId = await findExternalId(
                queryService,
                tenantId,
                ExternalIdMappingResourceType.ORDER_LINE,
                lineId,
            );
            expect(lineExternalId).toBeGreaterThan(0);
        }
    });

    it('does not change existing mappings', async () => {
        const { tenantId, slug } = await createTestTenant(server);
        const user = await createAuthenticatedUser(app, tenantId, slug);
        const headers = authHeaders(user.accessToken);
        const fixture = await seedCommerceFixture(server, headers);
        const order = await createOrder(server, headers, fixture, `backfill-existing-${Date.now()}`);
        const before = await findExternalId(
            queryService,
            tenantId,
            ExternalIdMappingResourceType.ORDER,
            order.id,
        );
        expect(before).not.toBeNull();

        const backfill = createBackfillService(infra);
        await backfill.run({ tenantIds: [tenantId] });
        const after = await findExternalId(
            queryService,
            tenantId,
            ExternalIdMappingResourceType.ORDER,
            order.id,
        );
        expect(after).toBe(before);
    });

    it('backfills shipment, cancellation, and return mappings', async () => {
        const { tenantId, slug } = await createTestTenant(server);
        const user = await createAuthenticatedUser(app, tenantId, slug);
        const headers = authHeaders(user.accessToken);
        const fixture = await seedCommerceFixture(server, headers);
        const order = await createOrder(server, headers, fixture, `backfill-all-types-${Date.now()}`, 2);
        await setOrderStatus(infra.database, tenantId, order.id, 'NEW');
        const orderExternalId = await findExternalId(
            queryService,
            tenantId,
            ExternalIdMappingResourceType.ORDER,
            order.id,
        );
        await server.inject({
            method: 'POST',
            url: '/api/v2/orders/acknowledge',
            headers: acknowledgeHeaders(headers, 'backfill-ack'),
            payload: acknowledgePayload(order.orderNumber, orderExternalId),
        });
        const merchantShipmentNo = `BF-SHIP-${Date.now()}`;
        await server.inject({
            method: 'POST',
            url: '/api/v2/shipments',
            headers: shipmentHeaders(headers, 'backfill-ship'),
            payload: shipmentPayload(order.orderNumber, fixture.merchantSku, 1, merchantShipmentNo),
        });
        const merchantCancellationNo = `BF-CAN-${Date.now()}`;
        await server.inject({
            method: 'POST',
            url: '/api/v2/cancellations',
            headers: cancellationHeaders(headers, 'backfill-cancel'),
            payload: cancellationPayload(order.orderNumber, fixture.merchantSku, 1, merchantCancellationNo),
        });
        const merchantReturnNo = `BF-RET-${Date.now()}`;
        await server.inject({
            method: 'POST',
            url: '/api/v2/returns',
            headers: returnHeaders(headers, 'backfill-return'),
            payload: returnPayload(order.orderNumber, fixture.merchantSku, 1, merchantReturnNo),
        });

        const shipmentId = await findShipmentId(infra.database, tenantId, order.id);
        const cancellationId = await findCancellationId(infra.database, tenantId, order.id);
        const returnId = await findReturnId(infra.database, tenantId, merchantReturnNo);
        expect(shipmentId).toBeTruthy();
        expect(cancellationId).toBeTruthy();
        expect(returnId).toBeTruthy();

        await deleteMappingsForResources(infra.database, tenantId, [
            order.id,
            ...order.lines.map((line) => line.id),
            shipmentId,
            cancellationId,
            returnId,
        ]);

        const backfill = createBackfillService(infra);
        await backfill.run({ tenantIds: [tenantId], batchSize: 5 });

        expect(await findExternalId(queryService, tenantId, ExternalIdMappingResourceType.SHIPMENT, shipmentId))
            .toBeGreaterThan(0);
        expect(await findExternalId(queryService, tenantId, ExternalIdMappingResourceType.CANCELLATION, cancellationId))
            .toBeGreaterThan(0);
        expect(await findExternalId(queryService, tenantId, ExternalIdMappingResourceType.RETURN, returnId))
            .toBeGreaterThan(0);
    });

    it('is idempotent on rerun', async () => {
        const { tenantId, slug } = await createTestTenant(server);
        const user = await createAuthenticatedUser(app, tenantId, slug);
        const headers = authHeaders(user.accessToken);
        const fixture = await seedCommerceFixture(server, headers);
        const order = await createOrder(server, headers, fixture, `backfill-idempotent-${Date.now()}`);
        await deleteMappingsForResources(infra.database, tenantId, [order.id, ...order.lines.map((line) => line.id)]);

        const backfill = createBackfillService(infra);
        await backfill.run({ tenantIds: [tenantId] });
        const countAfterFirst = await countMappingsForType(
            infra.database,
            tenantId,
            ExternalIdMappingResourceType.ORDER,
        );
        const second = await backfill.run({ tenantIds: [tenantId] });
        const orderStats = second.tenants[0]?.resourceTypes.find(
            (entry) => entry.resourceType === ExternalIdMappingResourceType.ORDER,
        );
        expect(orderStats?.assigned).toBe(0);
        expect(orderStats?.processed).toBe(0);
        const countAfterSecond = await countMappingsForType(
            infra.database,
            tenantId,
            ExternalIdMappingResourceType.ORDER,
        );
        expect(countAfterSecond).toBe(countAfterFirst);
    });

    it('keeps mappings tenant-isolated', async () => {
        const tenantA = await createTestTenant(server);
        const tenantB = await createTestTenant(server);
        const userA = await createAuthenticatedUser(app, tenantA.tenantId, tenantA.slug);
        const userB = await createAuthenticatedUser(app, tenantB.tenantId, tenantB.slug);
        const headersA = authHeaders(userA.accessToken);
        const headersB = authHeaders(userB.accessToken);
        const fixtureA = await seedCommerceFixture(server, headersA);
        const fixtureB = await seedCommerceFixture(server, headersB);
        const orderA = await createOrder(server, headersA, fixtureA, `backfill-tenant-a-${Date.now()}`);
        const orderB = await createOrder(server, headersB, fixtureB, `backfill-tenant-b-${Date.now()}`);
        await deleteMappingsForResources(infra.database, tenantA.tenantId, [orderA.id, ...orderA.lines.map((l) => l.id)]);
        await deleteMappingsForResources(infra.database, tenantB.tenantId, [orderB.id, ...orderB.lines.map((l) => l.id)]);

        const backfill = createBackfillService(infra);
        await backfill.run({ tenantIds: [tenantA.tenantId, tenantB.tenantId] });

        const idA = await findExternalId(
            queryService,
            tenantA.tenantId,
            ExternalIdMappingResourceType.ORDER,
            orderA.id,
        );
        const idB = await findExternalId(
            queryService,
            tenantB.tenantId,
            ExternalIdMappingResourceType.ORDER,
            orderB.id,
        );
        expect(idA).toBeGreaterThan(0);
        expect(idB).toBeGreaterThan(0);
        expect(await findExternalId(queryService, tenantB.tenantId, ExternalIdMappingResourceType.ORDER, orderA.id))
            .toBeNull();
        expect(await findExternalId(queryService, tenantA.tenantId, ExternalIdMappingResourceType.ORDER, orderB.id))
            .toBeNull();
    });

    it('rolls back a failed batch without partial mappings', async () => {
        const { tenantId, slug } = await createTestTenant(server);
        const user = await createAuthenticatedUser(app, tenantId, slug);
        const headers = authHeaders(user.accessToken);
        const fixture = await seedCommerceFixture(server, headers);
        const orderOne = await createOrder(server, headers, fixture, `backfill-roll-1-${Date.now()}`);
        const orderTwo = await createOrder(server, headers, fixture, `backfill-roll-2-${Date.now()}`);
        await deleteMappingsForResources(infra.database, tenantId, [
            orderOne.id,
            ...orderOne.lines.map((line) => line.id),
            orderTwo.id,
            ...orderTwo.lines.map((line) => line.id),
        ]);

        const module = createExternalIdMappingModule({ database: infra.database });
        const original = module.externalIntegerIdMappingCommandService;
        const failingCommand = {
            assignMapping: vi.fn(async (transaction, command) => {
                if (command.resourceId === orderTwo.id) {
                    throw new Error('forced backfill failure');
                }
                return original.assignMapping(transaction, command);
            }),
        };
        const backfill = createBackfillService(infra, { commandService: failingCommand });

        await expect(backfill.run({ tenantIds: [tenantId], batchSize: 50 })).rejects.toThrow();
        expect(await findExternalId(queryService, tenantId, ExternalIdMappingResourceType.ORDER, orderOne.id))
            .toBeNull();
        expect(await findExternalId(queryService, tenantId, ExternalIdMappingResourceType.ORDER, orderTwo.id))
            .toBeNull();
    });

    it('handles concurrent backfill without duplicate mappings', async () => {
        const { tenantId, slug } = await createTestTenant(server);
        const user = await createAuthenticatedUser(app, tenantId, slug);
        const headers = authHeaders(user.accessToken);
        const fixture = await seedCommerceFixture(server, headers);
        const order = await createOrder(server, headers, fixture, `backfill-concurrent-${Date.now()}`);
        await deleteMappingsForResources(infra.database, tenantId, [order.id, ...order.lines.map((line) => line.id)]);

        const backfillA = createBackfillService(infra);
        const backfillB = createBackfillService(infra);
        await Promise.all([
            backfillA.run({ tenantIds: [tenantId], batchSize: 3 }),
            backfillB.run({ tenantIds: [tenantId], batchSize: 3 }),
        ]);

        const mappingCount = await infra.database.query(
            `SELECT COUNT(*)::int AS count
       FROM external_integer_id_mappings
       WHERE tenant_id = $1 AND resource_id = $2`,
            [tenantId, order.id],
            { operation: 'test.count_mappings_for_resource' },
        );
        expect(mappingCount.rows[0]?.count).toBe(1);
        expect(await findExternalId(queryService, tenantId, ExternalIdMappingResourceType.ORDER, order.id))
            .toBeGreaterThan(0);
    });

    it('exposes external integer IDs on compatibility reads after backfill', async () => {
        const { tenantId, slug } = await createTestTenant(server);
        const user = await createAuthenticatedUser(app, tenantId, slug);
        const headers = authHeaders(user.accessToken);
        const fixture = await seedCommerceFixture(server, headers);
        const order = await createOrder(server, headers, fixture, `backfill-compat-${Date.now()}`);
        await setOrderStatus(infra.database, tenantId, order.id, 'NEW');
        await deleteMappingsForResources(infra.database, tenantId, [order.id, ...order.lines.map((line) => line.id)]);

        const backfill = createBackfillService(infra);
        await backfill.run({ tenantIds: [tenantId] });

        const response = await server.inject({
            method: 'GET',
            url: '/api/v2/orders/new',
            headers,
        });
        expect(response.statusCode).toBe(200);
        const entry = response.json().Content.find((item) => item.MerchantOrderNo === order.orderNumber);
        expect(entry).toBeTruthy();
        expect(entry.Id).toBeGreaterThan(0);
        expect(entry.Lines?.[0]?.Id).toBeGreaterThan(0);
    });
});
