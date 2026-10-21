/**
 * Audit event type vocabulary (persisted `event_type` values).
 * @type {readonly string[]}
 */
export const AUDIT_EVENT_TYPES = Object.freeze([
    'USER_CREATED',
    'USER_STATUS_CHANGED',
    'MEMBERSHIP_CREATED',
    'MEMBERSHIP_ACTIVATED',
    'MEMBERSHIP_SUSPENDED',
    'MEMBERSHIP_REVOKED',
    'ROLE_CREATED',
    'ROLE_UPDATED',
    'ROLE_ASSIGNED',
    'ROLE_REMOVED',
    'PASSWORD_CHANGED',
    'PASSWORD_RESET',
    'LOGIN_SUCCESS',
    'LOGIN_FAILURE',
    'REFRESH_REUSE_DETECTED',
    'API_KEY_CREATED',
    'API_KEY_ROTATED',
    'API_KEY_REVOKED',
    'MFA_ENABLED',
    'MFA_DISABLED',
    'MFA_STEP_UP',
    'MARKETPLACE_STATUS_CHANGED',
    'CHANNEL_STATUS_CHANGED',
    'PRODUCT_CREATED',
    'PRODUCT_UPDATED',
    'PRODUCT_STATUS_CHANGED',
    'PRODUCT_CONTENT_UPSERTED',
    'PRICE_CREATED',
    'PRICE_UPDATED',
    'PRICE_DEACTIVATED',
    'OFFER_CREATED',
    'OFFER_UPDATED',
    'OFFER_STATUS_CHANGED',
    'STOCK_LOCATION_CREATED',
    'INVENTORY_ADJUSTED',
    'INVENTORY_RECEIVED',
    'INVENTORY_RESERVED',
    'INVENTORY_RELEASED',
    'INVENTORY_SALE_RECORDED',
    'INVENTORY_RETURN_RECORDED',
    'ORDER_CREATED',
    'ORDER_STATUS_CHANGED',
    'CANCELLATION_CREATED',
    'SHIPMENT_CREATED',
    'SHIPMENT_SHIPPED',
    'SHIPMENT_DELIVERED',
    'SHIPMENT_CANCELLED',
    'RETURN_CREATED',
    'RETURN_APPROVED',
    'RETURN_RECEIVED',
    'RETURN_COMPLETED',
    'RETURN_REJECTED',
    'RETURN_CANCELLED',
    'WEBHOOK_SUBSCRIPTION_CREATED',
    'WEBHOOK_SUBSCRIPTION_UPDATED',
    'WEBHOOK_SUBSCRIPTION_DISABLED',
    'WEBHOOK_SECRET_ROTATED',
]);

/**
 * @typedef {{
 *   id: string,
 *   tenantId: string | null,
 *   actorKind: 'user' | 'api-key' | 'system',
 *   actorId: string | null,
 *   eventType: string,
 *   resourceType: string | null,
 *   resourceId: string | null,
 *   metadata: Record<string, unknown>,
 *   ipAddress: string | null,
 *   requestId: string | null,
 *   createdAt: Date,
 * }} AuditEvent
 */

/**
 * Maps a validated audit_log row into a plain audit event entity.
 * @param {{
 *   id: string,
 *   tenant_id: string | null,
 *   actor_kind: 'user' | 'api-key' | 'system',
 *   actor_id: string | null,
 *   event_type: string,
 *   resource_type: string | null,
 *   resource_id: string | null,
 *   metadata: Record<string, unknown>,
 *   ip_address: string | null,
 *   request_id: string | null,
 *   created_at: Date,
 * }} row
 * @returns {AuditEvent}
 */
export function reconstituteAuditEvent(row) {
    return {
        id: row.id,
        tenantId: row.tenant_id,
        actorKind: row.actor_kind,
        actorId: row.actor_id,
        eventType: row.event_type,
        resourceType: row.resource_type,
        resourceId: row.resource_id,
        metadata: row.metadata,
        ipAddress: row.ip_address,
        requestId: row.request_id,
        createdAt: row.created_at,
    };
}
