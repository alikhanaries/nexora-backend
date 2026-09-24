import { afterAll, beforeAll, describe, expect, it } from 'vitest';
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
    acknowledgeHeaders,
    acknowledgePayload,
    cancellationHeaders,
    cancellationPayload,
    createOrder,
    findCompatExternalId,
    findReturnExternalIdByMerchantNo,
    receiveReturnPayload,
    returnHeaders,
    returnPayload,
    seedCommerceFixture,
    setOrderToNew,
    shipmentHeaders,
    shipmentPayload,
    shipOrderQuantity,
} from './compatibility-helpers.js';
import { closeTestInfrastructure, getTestInfrastructure } from './helpers.js';

describe('compatibility inbound external ID resolution', () => {
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

    it('acknowledges an order when OrderId matches MerchantOrderNo', async () => {
        const { tenantId, slug } = await createTestTenant(server);
        const user = await createAuthenticatedUser(app, tenantId, slug);
        const headers = authHeaders(user.accessToken);
        const fixture = await seedCommerceFixture(server, headers);
        const order = await createOrder(server, headers, fixture, 'inbound-ack-order');
        await setOrderToNew(app.infra.database, tenantId, order.id);
        const orderExternalId = await findCompatExternalId(
            app,
            tenantId,
            ExternalIdMappingResourceType.ORDER,
            order.id,
        );

        const response = await server.inject({
            method: 'POST',
            url: '/api/v2/orders/acknowledge',
            headers: acknowledgeHeaders(headers, 'inbound-ack-order'),
            payload: acknowledgePayload(order.orderNumber, orderExternalId),
        });
        expect(response.statusCode).toBe(201);
    });

    it('rejects acknowledge when OrderId does not match MerchantOrderNo', async () => {
        const { tenantId, slug } = await createTestTenant(server);
        const user = await createAuthenticatedUser(app, tenantId, slug);
        const headers = authHeaders(user.accessToken);
        const fixture = await seedCommerceFixture(server, headers);
        const orderA = await createOrder(server, headers, fixture, 'inbound-ack-a');
        const orderB = await createOrder(server, headers, fixture, 'inbound-ack-b');
        await setOrderToNew(app.infra.database, tenantId, orderA.id);
        const orderBExternalId = await findCompatExternalId(
            app,
            tenantId,
            ExternalIdMappingResourceType.ORDER,
            orderB.id,
        );

        const response = await server.inject({
            method: 'POST',
            url: '/api/v2/orders/acknowledge',
            headers: acknowledgeHeaders(headers, 'inbound-ack-mismatch'),
            payload: acknowledgePayload(orderA.orderNumber, orderBExternalId),
        });
        expect(response.statusCode).toBe(409);
        expect(response.json().Success).toBe(false);
    });

    it('rejects unknown OrderId values', async () => {
        const { tenantId, slug } = await createTestTenant(server);
        const user = await createAuthenticatedUser(app, tenantId, slug);
        const headers = authHeaders(user.accessToken);
        const fixture = await seedCommerceFixture(server, headers);
        const order = await createOrder(server, headers, fixture, 'inbound-unknown-order');
        await setOrderToNew(app.infra.database, tenantId, order.id);

        const response = await server.inject({
            method: 'POST',
            url: '/api/v2/orders/acknowledge',
            headers: acknowledgeHeaders(headers, 'inbound-unknown-order-id'),
            payload: acknowledgePayload(order.orderNumber, 999999999),
        });
        expect(response.statusCode).toBe(404);
        expect(response.json().Success).toBe(false);
    });

    it('creates a shipment using OrderLineId resolution', async () => {
        const { tenantId, slug } = await createTestTenant(server);
        const user = await createAuthenticatedUser(app, tenantId, slug);
        const headers = authHeaders(user.accessToken);
        const fixture = await seedCommerceFixture(server, headers);
        const order = await createOrder(server, headers, fixture, 'inbound-shipment-line', 2);
        const orderLineExternalId = await findCompatExternalId(
            app,
            tenantId,
            ExternalIdMappingResourceType.ORDER_LINE,
            order.lines[0].id,
        );

        const response = await server.inject({
            method: 'POST',
            url: '/api/v2/shipments',
            headers: shipmentHeaders(headers, 'inbound-shipment-line'),
            payload: {
                ...shipmentPayload(order.orderNumber, fixture.merchantSku, 2, 'MSN-INBOUND-LINE'),
                Lines: [{
                    MerchantProductNo: fixture.merchantSku,
                    Quantity: 2,
                    OrderLineId: orderLineExternalId,
                }],
            },
        });
        expect(response.statusCode).toBe(201);
    });

    it('rejects OrderLineId from another order', async () => {
        const { tenantId, slug } = await createTestTenant(server);
        const user = await createAuthenticatedUser(app, tenantId, slug);
        const headers = authHeaders(user.accessToken);
        const fixture = await seedCommerceFixture(server, headers);
        const orderA = await createOrder(server, headers, fixture, 'inbound-line-a', 1);
        const orderB = await createOrder(server, headers, fixture, 'inbound-line-b', 1);
        const foreignLineExternalId = await findCompatExternalId(
            app,
            tenantId,
            ExternalIdMappingResourceType.ORDER_LINE,
            orderB.lines[0].id,
        );

        const response = await server.inject({
            method: 'POST',
            url: '/api/v2/shipments',
            headers: shipmentHeaders(headers, 'inbound-line-cross-order'),
            payload: {
                ...shipmentPayload(orderA.orderNumber, fixture.merchantSku, 1, 'MSN-CROSS-ORDER'),
                Lines: [{
                    MerchantProductNo: fixture.merchantSku,
                    Quantity: 1,
                    OrderLineId: foreignLineExternalId,
                }],
            },
        });
        expect(response.statusCode).toBe(409);
    });

    it('creates a cancellation using OrderLineId resolution', async () => {
        const { tenantId, slug } = await createTestTenant(server);
        const user = await createAuthenticatedUser(app, tenantId, slug);
        const headers = authHeaders(user.accessToken);
        const fixture = await seedCommerceFixture(server, headers);
        const order = await createOrder(server, headers, fixture, 'inbound-cancel-line', 2);
        const orderLineExternalId = await findCompatExternalId(
            app,
            tenantId,
            ExternalIdMappingResourceType.ORDER_LINE,
            order.lines[0].id,
        );

        const response = await server.inject({
            method: 'POST',
            url: '/api/v2/cancellations',
            headers: cancellationHeaders(headers, 'inbound-cancel-line'),
            payload: {
                ...cancellationPayload(order.orderNumber, fixture.merchantSku, 1, 'MCN-INBOUND-LINE'),
                Lines: [{
                    MerchantProductNo: fixture.merchantSku,
                    Quantity: 1,
                    OrderLineId: orderLineExternalId,
                }],
            },
        });
        expect(response.statusCode).toBe(201);
    });

    it('receives a return using ReturnId resolution', async () => {
        const { tenantId, slug } = await createTestTenant(server);
        const user = await createAuthenticatedUser(app, tenantId, slug);
        const headers = authHeaders(user.accessToken);
        const fixture = await seedCommerceFixture(server, headers);
        const order = await createOrder(server, headers, fixture, 'inbound-return-receive', 2);
        await shipOrderQuantity(server, headers, order.id, order.lines[0].id, 2, 'inbound-return-ship');
        const merchantReturnNo = 'MRN-INBOUND-RECEIVE';
        await server.inject({
            method: 'POST',
            url: '/api/v2/returns',
            headers: returnHeaders(headers, 'inbound-return-create'),
            payload: returnPayload(order.orderNumber, fixture.merchantSku, 2, merchantReturnNo),
        });
        const returnExternalId = await findReturnExternalIdByMerchantNo(app, tenantId, merchantReturnNo);

        const response = await server.inject({
            method: 'PUT',
            url: '/api/v2/returns',
            headers: returnHeaders(headers, 'inbound-return-receive'),
            payload: receiveReturnPayload(fixture.merchantSku, 2, returnExternalId),
        });
        expect(response.statusCode).toBe(200);
    });

    it('rejects unknown ReturnId values', async () => {
        const { tenantId, slug } = await createTestTenant(server);
        const user = await createAuthenticatedUser(app, tenantId, slug);
        const headers = authHeaders(user.accessToken);
        const fixture = await seedCommerceFixture(server, headers);
        const order = await createOrder(server, headers, fixture, 'inbound-return-unknown', 1);
        await shipOrderQuantity(server, headers, order.id, order.lines[0].id, 1, 'inbound-return-unknown-ship');
        await server.inject({
            method: 'POST',
            url: '/api/v2/returns',
            headers: returnHeaders(headers, 'inbound-return-unknown-create'),
            payload: returnPayload(order.orderNumber, fixture.merchantSku, 1, 'MRN-UNKNOWN'),
        });

        const response = await server.inject({
            method: 'PUT',
            url: '/api/v2/returns',
            headers: returnHeaders(headers, 'inbound-return-unknown-receive'),
            payload: receiveReturnPayload(fixture.merchantSku, 1, 999999999),
        });
        expect(response.statusCode).toBe(404);
    });

    it('does not resolve tenant A OrderId for tenant B', async () => {
        const tenantA = await createTestTenant(server);
        const tenantB = await createTestTenant(server);
        const userA = await createAuthenticatedUser(app, tenantA.tenantId, tenantA.slug);
        const userB = await createAuthenticatedUser(app, tenantB.tenantId, tenantB.slug);
        const headersA = authHeaders(userA.accessToken);
        const headersB = authHeaders(userB.accessToken);
        const fixtureA = await seedCommerceFixture(server, headersA);
        const fixtureB = await seedCommerceFixture(server, headersB);
        const orderA = await createOrder(server, headersA, fixtureA, 'inbound-tenant-a');
        const orderB = await createOrder(server, headersB, fixtureB, 'inbound-tenant-b');
        await setOrderToNew(app.infra.database, tenantA.tenantId, orderA.id);
        await setOrderToNew(app.infra.database, tenantB.tenantId, orderB.id);
        const orderAExternalId = await findCompatExternalId(
            app,
            tenantA.tenantId,
            ExternalIdMappingResourceType.ORDER,
            orderA.id,
        );

        const crossTenantLookup = await queryService.findResourceIdByExternalId(
            tenantB.tenantId,
            ExternalIdMappingProvider.COMPAT_V2,
            ExternalIdMappingResourceType.ORDER,
            orderAExternalId,
        );
        expect(crossTenantLookup).not.toBe(orderA.id);

        const response = await server.inject({
            method: 'POST',
            url: '/api/v2/orders/acknowledge',
            headers: acknowledgeHeaders(headersB, 'inbound-cross-tenant-order-id'),
            payload: acknowledgePayload('ORD-DOES-NOT-EXIST-IN-B', orderAExternalId),
        });
        expect(response.statusCode).toBe(404);
    });

    it('resolves resource types independently for the same integer value', async () => {
        const { tenantId, slug } = await createTestTenant(server);
        const user = await createAuthenticatedUser(app, tenantId, slug);
        const headers = authHeaders(user.accessToken);
        const fixture = await seedCommerceFixture(server, headers);
        const order = await createOrder(server, headers, fixture, 'inbound-resource-type', 1);
        const orderExternalId = await findCompatExternalId(
            app,
            tenantId,
            ExternalIdMappingResourceType.ORDER,
            order.id,
        );

        const resolvedAsReturn = await queryService.findResourceIdByExternalId(
            tenantId,
            ExternalIdMappingProvider.COMPAT_V2,
            ExternalIdMappingResourceType.RETURN,
            orderExternalId,
        );
        expect(resolvedAsReturn).toBeNull();
    });
});
