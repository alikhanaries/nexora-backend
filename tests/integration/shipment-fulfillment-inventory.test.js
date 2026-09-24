import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createApplication } from '../../src/app/bootstrap/create-application.js';
import {
    authHeaders,
    createAuthenticatedUser,
    createTestTenant,
} from './auth-helpers.js';
import {
    channelOrderHeaders,
    channelOrderPayload,
    configureChannelForIngest,
    createOrder,
    seedCommerceFixture,
    shipmentHeaders,
    shipmentPayload,
} from './compatibility-helpers.js';
import { closeTestInfrastructure, getTestInfrastructure } from './helpers.js';

const CHANNEL_FULFILLED_URL = '/api/v2/orders/channel-fulfilled';
const INITIAL_STOCK = 100;

describe('shipment fulfillment inventory integration (ADR-027)', () => {
    let app;
    let server;

    beforeAll(async () => {
        const infra = await getTestInfrastructure();
        app = await createApplication(infra);
        server = app.httpServer;
        await server.ready();
    });

    afterAll(async () => {
        await closeTestInfrastructure();
    });

    async function balanceAt(headers, productId, stockLocationId) {
        const res = await server.inject({
            method: 'GET',
            url: `/api/v1/inventory/${productId}?stockLocationId=${stockLocationId}`,
            headers,
        });
        expect(res.statusCode).toBe(200);
        const row = res.json().data.find((b) => b.stockLocationId === stockLocationId);
        expect(row).toBeDefined();
        return row;
    }

    async function reservationForOrder(tenantId, orderId, productId, stockLocationId) {
        const result = await app.infra.database.query(
            `SELECT quantity, status FROM inventory_reservations
             WHERE tenant_id = $1 AND reference_type = 'ORDER' AND reference_id = $2
               AND product_id = $3 AND stock_location_id = $4`,
            [tenantId, orderId, productId, stockLocationId],
            { operation: 'test.reservation_for_order' },
        );
        return result.rows[0] ?? null;
    }

    async function saleMovementCount(tenantId, shipmentId, shipmentLineId) {
        const result = await app.infra.database.query(
            `SELECT COUNT(*)::int AS count FROM inventory_movements
             WHERE tenant_id = $1 AND reference_type = 'SHIPMENT' AND reference_id = $2
               AND movement_type = 'SALE' AND idempotency_key = $3`,
            [tenantId, shipmentId, shipmentLineId],
            { operation: 'test.sale_movement_count' },
        );
        return result.rows[0].count;
    }

    async function createShipmentNative(headers, orderId, orderLineId, quantity, idempotencyKey) {
        const res = await server.inject({
            method: 'POST',
            url: `/api/v1/orders/${orderId}/shipments`,
            headers: { ...headers, 'idempotency-key': idempotencyKey },
            payload: { lines: [{ orderLineId, quantity }] },
        });
        expect(res.statusCode).toBe(201);
        return res.json().data;
    }

    async function shipNative(headers, shipmentId) {
        return server.inject({
            method: 'POST',
            url: `/api/v1/shipments/${shipmentId}/ship`,
            headers,
            payload: {},
        });
    }

    async function seedTenantWithOrder(orderQuantity) {
        const { tenantId, slug } = await createTestTenant(server);
        const user = await createAuthenticatedUser(app, tenantId, slug);
        const headers = authHeaders(user.accessToken);
        const fixture = await seedCommerceFixture(server, headers);
        const order = await createOrder(server, headers, fixture, `fulfill-${Date.now()}`, orderQuantity);
        const orderLineId = order.lines[0].id;
        const afterReserve = await balanceAt(headers, fixture.productId, fixture.stockLocationId);
        expect(afterReserve.onHand).toBe(INITIAL_STOCK);
        expect(afterReserve.reserved).toBe(orderQuantity);
        expect(afterReserve.available).toBe(INITIAL_STOCK - orderQuantity);
        return { tenantId, headers, fixture, order, orderLineId };
    }

    it('fulfills reserved inventory when shipment is marked SHIPPED', async () => {
        const { tenantId, headers, fixture, order, orderLineId } = await seedTenantWithOrder(4);
        const shipment = await createShipmentNative(headers, order.id, orderLineId, 4, `ship-create-${Date.now()}`);
        const shipRes = await shipNative(headers, shipment.id);
        expect(shipRes.statusCode).toBe(200);

        const balance = await balanceAt(headers, fixture.productId, fixture.stockLocationId);
        expect(balance.onHand).toBe(INITIAL_STOCK - 4);
        expect(balance.reserved).toBe(0);
        expect(balance.available).toBe(INITIAL_STOCK - 4);

        const reservation = await reservationForOrder(tenantId, order.id, fixture.productId, fixture.stockLocationId);
        expect(reservation.status).toBe('RELEASED');

        const lineId = shipment.lines[0].id;
        expect(await saleMovementCount(tenantId, shipment.id, lineId)).toBe(1);
    });

    it('supports partial shipment fulfillment and keeps reservation ACTIVE until fully consumed', async () => {
        const { tenantId, headers, fixture, order, orderLineId } = await seedTenantWithOrder(10);
        const shipment1 = await createShipmentNative(headers, order.id, orderLineId, 4, `partial-a-${Date.now()}`);
        expect((await shipNative(headers, shipment1.id)).statusCode).toBe(200);

        let balance = await balanceAt(headers, fixture.productId, fixture.stockLocationId);
        expect(balance.onHand).toBe(INITIAL_STOCK - 4);
        expect(balance.reserved).toBe(6);
        expect(balance.available).toBe(INITIAL_STOCK - 10);

        let reservation = await reservationForOrder(tenantId, order.id, fixture.productId, fixture.stockLocationId);
        expect(reservation.status).toBe('ACTIVE');
        expect(reservation.quantity).toBe(6);

        const shipment2 = await createShipmentNative(headers, order.id, orderLineId, 6, `partial-b-${Date.now()}`);
        expect((await shipNative(headers, shipment2.id)).statusCode).toBe(200);

        balance = await balanceAt(headers, fixture.productId, fixture.stockLocationId);
        expect(balance.onHand).toBe(INITIAL_STOCK - 10);
        expect(balance.reserved).toBe(0);
        expect(balance.available).toBe(INITIAL_STOCK - 10);

        reservation = await reservationForOrder(tenantId, order.id, fixture.productId, fixture.stockLocationId);
        expect(reservation.status).toBe('RELEASED');
    });

    it('is idempotent when fulfillment is retried for the same shipment line', async () => {
        const { tenantId, headers, fixture, order, orderLineId } = await seedTenantWithOrder(3);
        const shipment = await createShipmentNative(headers, order.id, orderLineId, 3, `idem-ship-${Date.now()}`);
        expect((await shipNative(headers, shipment.id)).statusCode).toBe(200);

        const lineId = shipment.lines[0].id;
        await app.infra.database.execute(async (tx) => {
            const input = {
                tenantId,
                stockLocationId: fixture.stockLocationId,
                productId: fixture.productId,
                quantity: 3,
                orderId: order.id,
                shipmentId: shipment.id,
                shipmentLineId: lineId,
                orderLineId,
            };
            await app.inventory.inventoryService.fulfillReservedForShipment(input, tx);
            await app.inventory.inventoryService.fulfillReservedForShipment(input, tx);
        }, { tenantId });

        const balance = await balanceAt(headers, fixture.productId, fixture.stockLocationId);
        expect(balance.onHand).toBe(INITIAL_STOCK - 3);
        expect(balance.reserved).toBe(0);
        expect(await saleMovementCount(tenantId, shipment.id, lineId)).toBe(1);
    });

    it('fulfills inventory when UpdateShipmentTracking transitions to SHIPPED', async () => {
        const { tenantId, headers, fixture, order } = await seedTenantWithOrder(2);
        const merchantShipmentNo = `MSN-TRACK-${Date.now()}`;
        const createRes = await server.inject({
            method: 'POST',
            url: '/api/v2/shipments',
            headers: shipmentHeaders(headers, `v2-create-${Date.now()}`),
            payload: shipmentPayload(order.orderNumber, fixture.merchantSku, 2, merchantShipmentNo),
        });
        expect(createRes.statusCode).toBe(201);

        const before = await balanceAt(headers, fixture.productId, fixture.stockLocationId);
        expect(before.reserved).toBe(2);

        const trackRes = await server.inject({
            method: 'PUT',
            url: `/api/v2/shipments/${merchantShipmentNo}`,
            headers: shipmentHeaders(headers, `v2-track-${Date.now()}`),
            payload: { Method: 'DHL', TrackTraceNo: 'TRACK-FULFILL-1' },
        });
        expect(trackRes.statusCode).toBe(200);

        const after = await balanceAt(headers, fixture.productId, fixture.stockLocationId);
        expect(after.onHand).toBe(INITIAL_STOCK - 2);
        expect(after.reserved).toBe(0);
        expect(after.available).toBe(INITIAL_STOCK - 2);

        const shipments = await server.inject({
            method: 'GET',
            url: `/api/v1/shipments?orderId=${order.id}`,
            headers,
        });
        const shipmentId = shipments.json().data.items[0].id;
        const detail = await server.inject({
            method: 'GET',
            url: `/api/v1/shipments/${shipmentId}`,
            headers,
        });
        const lineId = detail.json().data.lines[0].id;
        expect(await saleMovementCount(tenantId, shipmentId, lineId)).toBe(1);
    });

    it('does not fulfill inventory again when tracking is updated on an already SHIPPED shipment', async () => {
        const { tenantId, headers, fixture, order } = await seedTenantWithOrder(2);
        const merchantShipmentNo = `MSN-RETRACK-${Date.now()}`;
        await server.inject({
            method: 'POST',
            url: '/api/v2/shipments',
            headers: shipmentHeaders(headers, `v2-re-${Date.now()}`),
            payload: shipmentPayload(order.orderNumber, fixture.merchantSku, 2, merchantShipmentNo),
        });
        await server.inject({
            method: 'PUT',
            url: `/api/v2/shipments/${merchantShipmentNo}`,
            headers: shipmentHeaders(headers, `v2-re-ship-${Date.now()}`),
            payload: { Method: 'DHL', TrackTraceNo: 'TRACK-1' },
        });

        const mid = await balanceAt(headers, fixture.productId, fixture.stockLocationId);
        expect(mid.onHand).toBe(INITIAL_STOCK - 2);

        await server.inject({
            method: 'PUT',
            url: `/api/v2/shipments/${merchantShipmentNo}`,
            headers: shipmentHeaders(headers, `v2-re-ship-2-${Date.now()}`),
            payload: { Method: 'UPS', TrackTraceNo: 'TRACK-2' },
        });

        const after = await balanceAt(headers, fixture.productId, fixture.stockLocationId);
        expect(after.onHand).toBe(mid.onHand);
        expect(after.reserved).toBe(mid.reserved);

        const shipments = await server.inject({
            method: 'GET',
            url: `/api/v1/shipments?orderId=${order.id}`,
            headers,
        });
        const shipmentId = shipments.json().data.items[0].id;
        const detail = await server.inject({
            method: 'GET',
            url: `/api/v1/shipments/${shipmentId}`,
            headers,
        });
        const lineId = detail.json().data.lines[0].id;
        expect(await saleMovementCount(tenantId, shipmentId, lineId)).toBe(1);
    });

    it('rolls back shipment status when inventory fulfillment fails', async () => {
        const { tenantId, headers, fixture, order, orderLineId } = await seedTenantWithOrder(5);
        await app.infra.database.query(
            `DELETE FROM inventory_reservations
             WHERE tenant_id = $1 AND reference_type = 'ORDER' AND reference_id = $2`,
            [tenantId, order.id],
            { operation: 'test.delete_reservation' },
        );

        const shipment = await createShipmentNative(headers, order.id, orderLineId, 5, `rollback-${Date.now()}`);
        const shipRes = await shipNative(headers, shipment.id);
        expect(shipRes.statusCode).toBeGreaterThanOrEqual(400);

        const getShipment = await server.inject({
            method: 'GET',
            url: `/api/v1/shipments/${shipment.id}`,
            headers,
        });
        expect(getShipment.json().data.status).not.toBe('SHIPPED');

        const balance = await balanceAt(headers, fixture.productId, fixture.stockLocationId);
        expect(balance.onHand).toBe(INITIAL_STOCK);
        expect(balance.reserved).toBe(5);
    });

    it('serializes concurrent fulfillment so inventory is not double-decremented', async () => {
        const { headers, fixture, order, orderLineId } = await seedTenantWithOrder(10);
        const shipmentA = await createShipmentNative(headers, order.id, orderLineId, 4, `conc-a-${Date.now()}`);
        const shipmentB = await createShipmentNative(headers, order.id, orderLineId, 4, `conc-b-${Date.now()}`);

        const results = await Promise.all([
            shipNative(headers, shipmentA.id),
            shipNative(headers, shipmentB.id),
        ]);
        expect(results.every((r) => r.statusCode === 200)).toBe(true);

        const balance = await balanceAt(headers, fixture.productId, fixture.stockLocationId);
        expect(balance.onHand).toBe(INITIAL_STOCK - 8);
        expect(balance.reserved).toBe(2);
        expect(balance.available).toBe(INITIAL_STOCK - 10);
    });

    it('uses recordSale for channel-fulfilled orders without touching reserved', async () => {
        const { tenantId, slug } = await createTestTenant(server);
        const user = await createAuthenticatedUser(app, tenantId, slug);
        const headers = authHeaders(user.accessToken);
        const fixture = await seedCommerceFixture(server, headers);
        const channelContext = await configureChannelForIngest(
            server,
            headers,
            fixture.channelId,
            fixture.stockLocationId,
        );
        const before = await balanceAt(headers, fixture.productId, fixture.stockLocationId);
        const qty = 2;

        const response = await server.inject({
            method: 'POST',
            url: CHANNEL_FULFILLED_URL,
            headers: channelOrderHeaders(
                headers,
                `channel-sale-${Date.now()}`,
                channelContext.channelExternalReference,
            ),
            payload: channelOrderPayload(fixture, `CH-SALE-${Date.now()}`, qty),
        });
        expect(response.statusCode).toBe(201);

        const after = await balanceAt(headers, fixture.productId, fixture.stockLocationId);
        expect(after.reserved).toBe(0);
        expect(after.onHand).toBe(before.onHand - qty);
        expect(after.available).toBe(after.onHand);

        const order = await app.orders.orderQueryService.findOrderByOrderNumber(
            tenantId,
            response.json().Content.MerchantOrderNo,
        );
        const reservation = await reservationForOrder(tenantId, order.id, fixture.productId, fixture.stockLocationId);
        expect(reservation).toBeNull();
    });

    it('does not fulfill inventory when another tenant attempts to ship the shipment', async () => {
        const owner = await seedTenantWithOrder(3);
        const intruder = await seedTenantWithOrder(3);

        const shipment = await createShipmentNative(
            owner.headers,
            owner.order.id,
            owner.orderLineId,
            3,
            `tenant-a-${Date.now()}`,
        );

        const shipRes = await shipNative(intruder.headers, shipment.id);
        expect(shipRes.statusCode).toBeGreaterThanOrEqual(400);

        const balanceOwner = await balanceAt(owner.headers, owner.fixture.productId, owner.fixture.stockLocationId);
        expect(balanceOwner.reserved).toBe(3);
        expect(balanceOwner.onHand).toBe(INITIAL_STOCK);

        const getShipment = await server.inject({
            method: 'GET',
            url: `/api/v1/shipments/${shipment.id}`,
            headers: owner.headers,
        });
        expect(getShipment.json().data.status).not.toBe('SHIPPED');
    });
});
