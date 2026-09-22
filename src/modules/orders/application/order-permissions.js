export function requireOrdersRead(authorization, permissions) {
    authorization.requirePermission(permissions, 'orders.read');
}
export function requireOrdersCreate(authorization, permissions) {
    authorization.requirePermission(permissions, 'orders.create');
}
export function requireOrdersIngest(authorization, permissions) {
    authorization.requirePermission(permissions, 'orders.ingest');
}
export function requireOrdersUpdate(authorization, permissions) {
    authorization.requirePermission(permissions, 'orders.update');
}
export function requireOrdersCancel(authorization, permissions) {
    authorization.requirePermission(permissions, 'orders.cancel');
}
