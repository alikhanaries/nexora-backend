import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { createApplication } from '../../src/app/bootstrap/create-application.js';
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
    cancellationHeaders,
    cancellationPayload,
    createOrder,
    returnHeaders,
    returnPayload,
    seedCommerceFixture,
    setOrderStatus,
    shipmentHeaders,
    shipmentPayload,
    shipOrderQuantity,
} from './compatibility-helpers.js';
import { closeTestInfrastructure, getTestInfrastructure } from './helpers.js';

async function findExternalId(queryService, tenantId, resourceType, resourceId) {
    return queryService.findExternalIdByResourceId(
        tenantId,
        ExternalIdMappingProvider.COMPAT_V2,
        resourceType,
        resourceId,
    );
}

async function findResourceIdByExternalReference(database, tenantId, table, externalReference) {
    const result = await database.query(
        `SELECT id FROM ${table} WHERE tenant_id = $1 AND external_reference = $2`,
        [tenantId, externalReference],
        { operation: `test.find_${table}_by_external_reference` },
    );
    return result.rows[0]?.id;
}

describe('compatibility external ID response enrichment', () => {
    let app;
    let server;
    /** @type {import('../../src/modules/external-id-mapping/public/external-integer-id-mapping-query-service.js').ExternalIntegerIdMappingQueryService} */
    let queryService;

    beforeAll(async () => {
        const infra = await getTestInfrastructure();
        app = await createApplication(infra);
        server = app.httpServer;
        await server.ready();
        queryService = app.compatibility.coreContracts.externalIntegerIdMappingQueryService;
    });

    afterAll(async () => {
        await closeTestInfrastructure();
    });

    it('enriches GET /api/v2/orders with external order and line IDs', async () => {
        const { tenantId, slug } = await createTestTenant(server);
        const user = await createAuthenticatedUser(app, tenantId, slug);
        const headers = authHeaders(user.accessToken);
        const fixture = await seedCommerceFixture(server, headers);
        const order = await createOrder(server, headers, fixture, 'ext-id-orders-list', 2);

        const response = await server.inject({
            method: 'GET',
            url: '/api/v2/orders',
            headers,
        });
        expect(response.statusCode).toBe(200);
        const entry = response.json().Content.find((item) => item.MerchantOrderNo === order.orderNumber);
        expect(entry).toBeTruthy();
        const expectedOrderId = await findExternalId(
            queryService,
            tenantId,
            ExternalIdMappingResourceType.ORDER,
            order.id,
        );
        const expectedLineId = await findExternalId(
            queryService,
            tenantId,
            ExternalIdMappingResourceType.ORDER_LINE,
            order.lines[0].id,
        );
        expect(entry.Id).toBe(expectedOrderId);
        expect(entry.Lines[0].Id).toBe(expectedLineId);
    });

    it('enriches GET /api/v2/orders/new with external order IDs', async () => {
        const { tenantId, slug } = await createTestTenant(server);
        const user = await createAuthenticatedUser(app, tenantId, slug);
        const headers = authHeaders(user.accessToken);
        const fixture = await seedCommerceFixture(server, headers);
        const order = await createOrder(server, headers, fixture, 'ext-id-orders-new');
        await setOrderStatus(app.infra.database, tenantId, order.id, 'NEW');

        const response = await server.inject({
            method: 'GET',
            url: '/api/v2/orders/new',
            headers,
        });
        expect(response.statusCode).toBe(200);
        const entry = response.json().Content.find((item) => item.MerchantOrderNo === order.orderNumber);
        expect(entry).toBeTruthy();
        const expectedOrderId = await findExternalId(
            queryService,
            tenantId,
            ExternalIdMappingResourceType.ORDER,
            order.id,
        );
        expect(entry.Id).toBe(expectedOrderId);
        expect(entry.tenantId).toBeUndefined();
    });

    it('enriches GET /api/v2/shipments/merchant with external shipment IDs', async () => {
        const { tenantId, slug } = await createTestTenant(server);
        const user = await createAuthenticatedUser(app, tenantId, slug);
        const headers = authHeaders(user.accessToken);
        const fixture = await seedCommerceFixture(server, headers);
        const order = await createOrder(server, headers, fixture, 'ext-id-shipment', 2);
        const merchantShipmentNo = 'MSN-EXT-ID';
        await server.inject({
            method: 'POST',
            url: '/api/v2/shipments',
            headers: shipmentHeaders(headers, 'ext-id-shipment-create'),
            payload: shipmentPayload(order.orderNumber, fixture.merchantSku, 2, merchantShipmentNo),
        });

        const listResponse = await server.inject({
            method: 'GET',
            url: '/api/v2/shipments/merchant',
            headers,
        });
        expect(listResponse.statusCode).toBe(200);
        const entry = listResponse.json().Content.find((item) => item.MerchantShipmentNo === merchantShipmentNo);
        expect(entry).toBeTruthy();
        const shipmentId = await findResourceIdByExternalReference(
            app.infra.database,
            tenantId,
            'shipments',
            merchantShipmentNo,
        );
        const expectedShipmentId = await findExternalId(
            queryService,
            tenantId,
            ExternalIdMappingResourceType.SHIPMENT,
            shipmentId,
        );
        expect(entry.Id).toBe(expectedShipmentId);
    });

    it('enriches GET /api/v2/cancellations/merchant with external cancellation IDs', async () => {
        const { tenantId, slug } = await createTestTenant(server);
        const user = await createAuthenticatedUser(app, tenantId, slug);
        const headers = authHeaders(user.accessToken);
        const fixture = await seedCommerceFixture(server, headers);
        const order = await createOrder(server, headers, fixture, 'ext-id-cancel', 2);
        const merchantCancellationNo = 'MCN-EXT-ID';
        await server.inject({
            method: 'POST',
            url: '/api/v2/cancellations',
            headers: cancellationHeaders(headers, 'ext-id-cancel-create'),
            payload: cancellationPayload(order.orderNumber, fixture.merchantSku, 1, merchantCancellationNo),
        });

        const response = await server.inject({
            method: 'GET',
            url: '/api/v2/cancellations/merchant',
            headers,
        });
        expect(response.statusCode).toBe(200);
        const entry = response.json().Content.find((item) => item.MerchantCancellationNo === merchantCancellationNo);
        expect(entry).toBeTruthy();
        const cancellationId = await findResourceIdByExternalReference(
            app.infra.database,
            tenantId,
            'cancellations',
            merchantCancellationNo,
        );
        const expectedCancellationId = await findExternalId(
            queryService,
            tenantId,
            ExternalIdMappingResourceType.CANCELLATION,
            cancellationId,
        );
        expect(entry.Id).toBe(expectedCancellationId);
    });

    it('enriches GET /api/v2/returns/merchant with external return IDs', async () => {
        const { tenantId, slug } = await createTestTenant(server);
        const user = await createAuthenticatedUser(app, tenantId, slug);
        const headers = authHeaders(user.accessToken);
        const fixture = await seedCommerceFixture(server, headers);
        const order = await createOrder(server, headers, fixture, 'ext-id-return', 2);
        const merchantReturnNo = 'MRN-EXT-ID';
        await shipOrderQuantity(server, headers, order.id, order.lines[0].id, order.lines[0].quantity, 'ext-id-return-ship');
        await server.inject({
            method: 'POST',
            url: '/api/v2/returns',
            headers: returnHeaders(headers, 'ext-id-return-create'),
            payload: returnPayload(order.orderNumber, fixture.merchantSku, 1, merchantReturnNo),
        });

        const response = await server.inject({
            method: 'GET',
            url: '/api/v2/returns/merchant',
            headers,
        });
        expect(response.statusCode).toBe(200);
        const entry = response.json().Content.find((item) => item.MerchantReturnNo === merchantReturnNo);
        expect(entry).toBeTruthy();
        const returnId = await findResourceIdByExternalReference(
            app.infra.database,
            tenantId,
            'returns',
            merchantReturnNo,
        );
        const expectedReturnId = await findExternalId(
            queryService,
            tenantId,
            ExternalIdMappingResourceType.RETURN,
            returnId,
        );
        expect(entry.Id).toBe(expectedReturnId);
    });

    it('omits external IDs for resources without mappings without returning 500', async () => {
        const { tenantId, slug } = await createTestTenant(server);
        const user = await createAuthenticatedUser(app, tenantId, slug);
        const headers = authHeaders(user.accessToken);
        const fixture = await seedCommerceFixture(server, headers);
        const order = await createOrder(server, headers, fixture, 'ext-id-unmapped');
        await setOrderStatus(app.infra.database, tenantId, order.id, 'NEW');
        await app.infra.database.query(
            'DELETE FROM external_integer_id_mappings WHERE tenant_id = $1 AND resource_id = $2',
            [tenantId, order.id],
            { operation: 'test.delete_order_external_mapping' },
        );

        const response = await server.inject({
            method: 'GET',
            url: '/api/v2/orders/new',
            headers,
        });
        expect(response.statusCode).toBe(200);
        const entry = response.json().Content.find((item) => item.MerchantOrderNo === order.orderNumber);
        expect(entry).toBeTruthy();
        expect(entry.Id).toBeUndefined();
    });

    it('does not expose tenant A external integer IDs to tenant B', async () => {
        const tenantA = await createTestTenant(server);
        const tenantB = await createTestTenant(server);
        const userA = await createAuthenticatedUser(app, tenantA.tenantId, tenantA.slug);
        const userB = await createAuthenticatedUser(app, tenantB.tenantId, tenantB.slug);
        const headersA = authHeaders(userA.accessToken);
        const headersB = authHeaders(userB.accessToken);
        const fixtureA = await seedCommerceFixture(server, headersA);
        const fixtureB = await seedCommerceFixture(server, headersB);
        const orderA = await createOrder(server, headersA, fixtureA, 'ext-id-tenant-a');
        const orderB = await createOrder(server, headersB, fixtureB, 'ext-id-tenant-b');
        await setOrderStatus(app.infra.database, tenantA.tenantId, orderA.id, 'NEW');
        await setOrderStatus(app.infra.database, tenantB.tenantId, orderB.id, 'NEW');

        const externalIdA = await findExternalId(
            queryService,
            tenantA.tenantId,
            ExternalIdMappingResourceType.ORDER,
            orderA.id,
        );
        const externalIdB = await findExternalId(
            queryService,
            tenantB.tenantId,
            ExternalIdMappingResourceType.ORDER,
            orderB.id,
        );

        const responseB = await server.inject({
            method: 'GET',
            url: '/api/v2/orders/new',
            headers: headersB,
        });
        expect(responseB.statusCode).toBe(200);
        const channelOrderNosB = responseB.json().Content.map((entry) => entry.ChannelOrderNo);
        expect(channelOrderNosB).toContain('ext-id-tenant-b');
        expect(channelOrderNosB).not.toContain('ext-id-tenant-a');

        const resolvedUnderTenantB = await queryService.findResourceIdByExternalId(
            tenantB.tenantId,
            ExternalIdMappingProvider.COMPAT_V2,
            ExternalIdMappingResourceType.ORDER,
            externalIdA,
        );
        expect(resolvedUnderTenantB).not.toBe(orderA.id);
        if (externalIdA === externalIdB) {
            expect(resolvedUnderTenantB).toBe(orderB.id);
        } else {
            expect(resolvedUnderTenantB).toBeNull();
        }
        expect(externalIdB).toEqual(expect.any(Number));
    });

    it('uses batch mapping lookups for order list responses', async () => {
        const { tenantId, slug } = await createTestTenant(server);
        const user = await createAuthenticatedUser(app, tenantId, slug);
        const headers = authHeaders(user.accessToken);
        const fixture = await seedCommerceFixture(server, headers);
        for (let index = 0; index < 3; index += 1) {
            const order = await createOrder(server, headers, fixture, `ext-id-batch-${index}`);
            await setOrderStatus(app.infra.database, tenantId, order.id, 'NEW');
        }

        const batchSpy = vi.spyOn(queryService, 'findExternalIdsByResourceIds');
        const singleSpy = vi.spyOn(queryService, 'findExternalIdByResourceId');
        batchSpy.mockClear();
        singleSpy.mockClear();

        const response = await server.inject({
            method: 'GET',
            url: '/api/v2/orders/new?ItemsPerPage=10',
            headers,
        });
        expect(response.statusCode).toBe(200);
        expect(response.json().Content.length).toBeGreaterThanOrEqual(3);
        expect(batchSpy.mock.calls.length).toBeGreaterThanOrEqual(2);
        expect(singleSpy).not.toHaveBeenCalled();

        const orderBatchCalls = batchSpy.mock.calls.filter((call) => call[2] === ExternalIdMappingResourceType.ORDER);
        expect(orderBatchCalls.length).toBeGreaterThanOrEqual(1);
        expect(orderBatchCalls[0][3].length).toBeGreaterThanOrEqual(3);

        batchSpy.mockRestore();
        singleSpy.mockRestore();
    });
});
