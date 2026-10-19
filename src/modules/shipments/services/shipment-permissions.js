export function requireShipmentsRead(authorization, permissions) {
    authorization.requirePermission(permissions, 'shipments.read');
}
export function requireShipmentsCreate(authorization, permissions) {
    authorization.requirePermission(permissions, 'shipments.create');
}
export function requireShipmentsUpdate(authorization, permissions) {
    authorization.requirePermission(permissions, 'shipments.update');
}
