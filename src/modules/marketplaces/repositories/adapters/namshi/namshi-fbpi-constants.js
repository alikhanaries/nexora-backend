/** Verified FBPI marketplace code on GetFbpiOrder (`mp_code`). */
export const NAMSHI_FBPI_MP_CODE = 'namshi';

/** Verified Event Notifications type for new/updated FBPI orders. */
export const NAMSHI_FBPI_EVENT_TYPE_ORDER_SYNC = 'FBPI::ORDER_SYNC';

/** Verified `mp_status` values (GetFbpiOrder items). */
export const NamshiFbpiMpItemStatus = Object.freeze({
    CONFIRMED: 'MP_ITEM_STATUS_CONFIRMED',
    CANCELLED: 'MP_ITEM_STATUS_CANCELLED',
    UNSPECIFIED: 'MP_ITEM_STATUS_UNSPECIFIED',
});

/** Verified `integration_status` values (GetFbpiOrder items). */
export const NamshiFbpiIntegrationItemStatus = Object.freeze({
    ACKNOWLEDGED: 'INTEGRATION_ITEM_STATUS_ACKNOWLEDGED',
    OUT_OF_STOCK: 'INTEGRATION_ITEM_STATUS_OUT_OF_STOCK',
    SHIPPED: 'INTEGRATION_ITEM_STATUS_SHIPPED',
    UNSPECIFIED: 'INTEGRATION_ITEM_STATUS_UNSPECIFIED',
});
