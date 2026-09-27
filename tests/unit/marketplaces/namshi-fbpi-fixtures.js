export function buildNamshiFbpiOrderSyncWebhook(overrides = {}) {
    return {
        event_schema_version: 1,
        event_type: 'FBPI::ORDER_SYNC',
        metadata: {
            message_id: 'msg-namshi-001',
            destination_id: 'dest-001',
            published_at: '2026-04-09T08:42:15Z',
            project_code: 'test-project',
        },
        payload: {
            order_nr: 'NFBO123456789',
        },
        ...overrides,
    };
}

export function buildNamshiFbpiGetOrderResponse(overrides = {}) {
    return {
        fbpi_order_nr: 'NFBO123456789',
        mp_code: 'namshi',
        mp_order_nr: 'NS123456789',
        mp_country_code: 'ae',
        customer_country_code: 'ae',
        merchant_code: 'STR-12345',
        currency_code: 'AED',
        warehouse_code: 'WH-NAMSHI-001',
        order_created_at: '2026-04-09T08:42:15Z',
        items: [{
            mp_item_nr: 'NFBO123456789-1',
            partner_sku: 'MY-SKU-001',
            mp_status: 'MP_ITEM_STATUS_CONFIRMED',
            integration_status: 'INTEGRATION_ITEM_STATUS_ACKNOWLEDGED',
            delivered_invoice_price: 149.99,
            cancellation_reason_code: null,
        }],
        ...overrides,
    };
}
