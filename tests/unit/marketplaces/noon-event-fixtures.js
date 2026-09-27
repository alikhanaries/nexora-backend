/**
 * @param {object} [overrides]
 */
export function buildNoonFbpiOrderSyncEvent(overrides = {}) {
    return {
        event_schema_version: 1,
        event_type: 'FBPI::ORDER_SYNC',
        metadata: {
            message_id: 'msg-noon-abc123',
            destination_id: 'dest-xyz',
            published_at: '2026-04-09T08:42:15Z',
            project_code: 'test-project',
            ...(overrides.metadata ?? {}),
        },
        payload: {
            order_nr: 'NFBO123456789',
            ...(overrides.payload ?? {}),
        },
        ...overrides,
    };
}

/**
 * @param {object} [overrides]
 */
export function buildNoonGetFbpiOrderResponse(overrides = {}) {
    return {
        fbpi_order_nr: 'NFBO123456789',
        mp_code: 'noon',
        mp_order_nr: 'NF123456789',
        mp_country_code: 'ae',
        customer_country_code: 'ae',
        merchant_code: 'STR-12345',
        currency_code: 'AED',
        warehouse_code: 'WH-NOON-001',
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
