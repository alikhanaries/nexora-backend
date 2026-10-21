/** Ensures the actor holds `shipments.read` before proceeding. */
export function requireShipmentsRead(authorization, permissions) {
    authorization.requirePermission(permissions, 'shipments.read');
}
/** Ensures the actor holds `shipments.create` before proceeding. */
export function requireShipmentsCreate(authorization, permissions) {
    authorization.requirePermission(permissions, 'shipments.create');
}
/** Ensures the actor holds `shipments.update` before proceeding. */
export function requireShipmentsUpdate(authorization, permissions) {
    authorization.requirePermission(permissions, 'shipments.update');
}
