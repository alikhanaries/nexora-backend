export function requireCancellationsRead(authorization, permissions) {
    authorization.requirePermission(permissions, 'cancellations.read');
}
export function requireCancellationsCreate(authorization, permissions) {
    authorization.requirePermission(permissions, 'cancellations.create');
}
export function requireOrdersCancel(authorization, permissions) {
    authorization.requirePermission(permissions, 'orders.cancel');
}
