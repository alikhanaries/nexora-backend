/** Requires `orders.read` for tenant order queries and listings. */
export function requireOrdersRead(authorization, permissions) {
    authorization.requirePermission(permissions, 'orders.read');
}

/** Requires `orders.create` for API/manual order creation. */
export function requireOrdersCreate(authorization, permissions) {
    authorization.requirePermission(permissions, 'orders.create');
}

/** Requires `orders.ingest` for marketplace pull/webhook order ingestion. */
export function requireOrdersIngest(authorization, permissions) {
    authorization.requirePermission(permissions, 'orders.ingest');
}

/** Requires `orders.ingest_channel_fulfilled` for channel-fulfilled ingest. */
export function requireOrdersIngestChannelFulfilled(authorization, permissions) {
    authorization.requirePermission(permissions, 'orders.ingest_channel_fulfilled');
}

/** Requires `orders.update` for confirm and other mutating order commands. */
export function requireOrdersUpdate(authorization, permissions) {
    authorization.requirePermission(permissions, 'orders.update');
}

/** Requires `orders.cancel` for cancellation flows. */
export function requireOrdersCancel(authorization, permissions) {
    authorization.requirePermission(permissions, 'orders.cancel');
}
