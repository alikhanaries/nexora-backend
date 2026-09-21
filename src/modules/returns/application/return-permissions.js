export function requireReturnsRead(authorization, permissions) {
    authorization.requirePermission(permissions, 'returns.read');
}
export function requireReturnsCreate(authorization, permissions) {
    authorization.requirePermission(permissions, 'returns.create');
}
export function requireReturnsUpdate(authorization, permissions) {
    authorization.requirePermission(permissions, 'returns.update');
}
