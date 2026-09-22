import { randomBytes } from 'node:crypto';
import { expect } from 'vitest';

export async function seedCommerceFixture(server, headers) {
    const suffix = randomBytes(8).toString('hex');
    const marketplaceRes = await server.inject({
        method: 'POST',
        url: '/api/v1/marketplaces',
        headers,
        payload: { key: `mp_${suffix}`, name: 'Compatibility Marketplace' },
    });
    expect(marketplaceRes.statusCode).toBe(201);
    const marketplaceId = marketplaceRes.json().data.id;
    const channelRes = await server.inject({
        method: 'POST',
        url: '/api/v1/channels',
        headers,
        payload: { marketplaceId, name: 'Compatibility Channel' },
    });
    expect(channelRes.statusCode).toBe(201);
    const channelId = channelRes.json().data.id;
    const productRes = await server.inject({
        method: 'POST',
        url: '/api/v1/products',
        headers,
        payload: { merchantSku: `SKU-${suffix}`, productType: 'STANDARD' },
    });
    expect(productRes.statusCode).toBe(201);
    const productId = productRes.json().data.id;
    const locationRes = await server.inject({
        method: 'POST',
        url: '/api/v1/stock-locations',
        headers,
        payload: { name: 'Compatibility Warehouse' },
    });
    expect(locationRes.statusCode).toBe(201);
    const stockLocationId = locationRes.json().data.id;
    await server.inject({
        method: 'POST',
        url: '/api/v1/inventory/receipts',
        headers,
        payload: {
            stockLocationId,
            productId,
            quantity: 100,
            referenceType: 'TEST',
            referenceId: `receipt-${Date.now()}`,
        },
    });
    await server.inject({
        method: 'POST',
        url: '/api/v1/prices',
        headers,
        payload: {
            productId,
            channelId,
            currency: 'USD',
            amountMinor: 2500,
        },
    });
    const offerRes = await server.inject({
        method: 'POST',
        url: '/api/v1/offers',
        headers,
        payload: { productId, channelId },
    });
    expect(offerRes.statusCode).toBe(201);
    const offerId = offerRes.json().data.id;
    const activateRes = await server.inject({
        method: 'POST',
        url: `/api/v1/offers/${offerId}/activate`,
        headers,
        payload: { requirePricing: true },
    });
    expect(activateRes.statusCode).toBe(200);
    return { channelId, productId, stockLocationId, merchantSku: `SKU-${suffix}` };
}

export async function createOrder(server, headers, fixture, externalOrderReference, quantity = 1) {
    const createRes = await server.inject({
        method: 'POST',
        url: '/api/v1/orders',
        headers: {
            ...headers,
            'idempotency-key': `order-${Date.now()}-${Math.random()}`,
        },
        payload: {
            channelId: fixture.channelId,
            currency: 'USD',
            externalOrderReference,
            lines: [{ productId: fixture.productId, stockLocationId: fixture.stockLocationId, quantity }],
            customer: {
                firstName: 'Test',
                lastName: 'Customer',
                email: 'customer@example.com',
            },
        },
    });
    expect(createRes.statusCode).toBe(201);
    return createRes.json().data;
}

export async function setOrderStatus(database, tenantId, orderId, status) {
    await database.query('UPDATE orders SET status = $3 WHERE tenant_id = $1 AND id = $2', [tenantId, orderId, status], { operation: 'test.set_order_status' });
}

export async function setOrderToNew(database, tenantId, orderId) {
    await database.query(`UPDATE orders SET status = 'NEW', confirmed_at = NULL WHERE tenant_id = $1 AND id = $2`, [tenantId, orderId], { operation: 'test.set_order_new' });
}

export function acknowledgePayload(merchantOrderNo, orderId = 12345) {
    return {
        MerchantOrderNo: merchantOrderNo,
        OrderId: orderId,
    };
}

export function acknowledgeHeaders(baseHeaders, idempotencyKey) {
    return {
        ...baseHeaders,
        'idempotency-key': idempotencyKey,
    };
}

export function shipmentPayload(merchantOrderNo, merchantSku, quantity, merchantShipmentNo = `SHIP-${Date.now()}`) {
    return {
        MerchantShipmentNo: merchantShipmentNo,
        MerchantOrderNo: merchantOrderNo,
        Lines: [{
            MerchantProductNo: merchantSku,
            Quantity: quantity,
            OrderLineId: 999001,
        }],
        Method: 'DHL',
        TrackTraceNo: 'TRACK-123',
    };
}

export function shipmentHeaders(baseHeaders, idempotencyKey) {
    return {
        ...baseHeaders,
        'idempotency-key': idempotencyKey,
    };
}

export function cancellationPayload(merchantOrderNo, merchantSku, quantity, merchantCancellationNo = `CAN-${Date.now()}`) {
    return {
        MerchantCancellationNo: merchantCancellationNo,
        MerchantOrderNo: merchantOrderNo,
        Lines: [{
            MerchantProductNo: merchantSku,
            Quantity: quantity,
            OrderLineId: 999001,
        }],
        Reason: 'Customer request',
    };
}

export function cancellationHeaders(baseHeaders, idempotencyKey) {
    return {
        ...baseHeaders,
        'idempotency-key': idempotencyKey,
    };
}

export async function shipOrderQuantity(server, headers, orderId, orderLineId, quantity, idempotencyKey) {
    const response = await server.inject({
        method: 'POST',
        url: `/api/v1/orders/${orderId}/shipments`,
        headers: {
            ...headers,
            'idempotency-key': idempotencyKey,
        },
        payload: { lines: [{ orderLineId, quantity }] },
    });
    expect(response.statusCode).toBe(201);
}

export function returnPayload(merchantOrderNo, merchantSku, quantity, merchantReturnNo = `RET-${Date.now()}`) {
    return {
        MerchantReturnNo: merchantReturnNo,
        MerchantOrderNo: merchantOrderNo,
        Lines: [{
            MerchantProductNo: merchantSku,
            Quantity: quantity,
            OrderLineId: 999001,
        }],
        Reason: 'PRODUCT_DEFECT',
        MerchantComment: 'Customer reported defect',
    };
}

export function returnHeaders(baseHeaders, idempotencyKey) {
    return {
        ...baseHeaders,
        'idempotency-key': idempotencyKey,
    };
}

export async function configureChannelForIngest(server, headers, channelId, stockLocationId, externalReference = 'channel-ref-ingest') {
    const response = await server.inject({
        method: 'PATCH',
        url: `/api/v1/channels/${channelId}`,
        headers,
        payload: {
            externalReference,
            configurationReference: stockLocationId,
        },
    });
    expect(response.statusCode).toBe(200);
    return { channelId, stockLocationId, channelExternalReference: externalReference };
}

export function channelOrderPayload(fixture, channelOrderNo, quantity = 1) {
    return {
        ChannelOrderNo: channelOrderNo,
        CurrencyCode: 'USD',
        Email: 'channel-buyer@example.com',
        OrderDate: '2026-01-15T10:00:00.000Z',
        ShippingCostsInclVat: 0,
        BillingAddress: {
            FirstName: 'Channel',
            LastName: 'Buyer',
            Line1: '1 Market Street',
            City: 'Amsterdam',
            ZipCode: '1011AB',
            CountryIso: 'NL',
        },
        ShippingAddress: {
            FirstName: 'Channel',
            LastName: 'Buyer',
            Line1: '1 Market Street',
            City: 'Amsterdam',
            ZipCode: '1011AB',
            CountryIso: 'NL',
        },
        Lines: [{
            MerchantProductNo: fixture.merchantSku,
            ChannelProductNo: fixture.merchantSku,
            Quantity: quantity,
            UnitPriceInclVat: 25,
        }],
    };
}

export function channelOrderHeaders(baseHeaders, idempotencyKey, channelExternalReference) {
    return {
        ...baseHeaders,
        'idempotency-key': idempotencyKey,
        ...(channelExternalReference === undefined
            ? {}
            : { 'x-channel-reference': channelExternalReference }),
    };
}

export async function createChannelScopedApiKey(app, tenantId, actorId, permissions, channelId, scopes) {
    const apiKey = await app.apiKeys.useCases.createApiKey.execute({
        tenantId,
        actorId,
        actorPermissions: permissions,
        name: 'Channel ingest key',
        scopes,
    });
    await app.infra.database.query(
        'UPDATE api_keys SET channel_id = $2 WHERE id = $1',
        [apiKey.id, channelId],
        { operation: 'test.bind_api_key_channel' },
    );
    return apiKey;
}

/**
 * @param {import('../../src/infrastructure/postgres/postgres-database.js').PostgresDatabase} database
 * @param {string} tenantId
 * @param {string} orderId
 * @param {string} eventType
 */
export async function countOutboxEventsForOrder(database, tenantId, orderId, eventType) {
    const result = await database.query(`SELECT COUNT(*)::int AS count
       FROM outbox_events
       WHERE tenant_id = $1
         AND aggregate_id = $2
         AND event_type = $3`, [tenantId, orderId, eventType], { operation: 'test.count_outbox_events' });
    return result.rows[0].count;
}

/**
 * @param {import('../../src/infrastructure/postgres/postgres-database.js').PostgresDatabase} database
 * @param {string} tenantId
 * @param {string} orderId
 * @param {string} eventType
 */
export async function countAuditEventsForOrder(database, tenantId, orderId, eventType) {
    return database.execute(async (tx) => {
        const result = await tx.query(`SELECT COUNT(*)::int AS count
         FROM audit_log
         WHERE tenant_id = $1
           AND resource_id = $2
           AND event_type = $3`, [tenantId, orderId, eventType], { operation: 'test.count_audit_events' });
        return result.rows[0].count;
    }, { tenantId });
}

/**
 * @param {import('../../src/infrastructure/postgres/postgres-database.js').PostgresDatabase} database
 * @param {string} tenantId
 * @param {string} orderId
 */
export async function snapshotAcknowledgeSideEffects(database, tenantId, orderId) {
    const [statusChanged, confirmed, auditStatusChanged] = await Promise.all([
        countOutboxEventsForOrder(database, tenantId, orderId, 'order.status_changed'),
        countOutboxEventsForOrder(database, tenantId, orderId, 'order.confirmed'),
        countAuditEventsForOrder(database, tenantId, orderId, 'ORDER_STATUS_CHANGED'),
    ]);
    return { statusChanged, confirmed, auditStatusChanged };
}
