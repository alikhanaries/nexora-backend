/** Ensures the actor holds `returns.read` before proceeding. */
export function requireReturnsRead(authorization, permissions) {
    authorization.requirePermission(permissions, 'returns.read');
}
/** Ensures the actor holds `returns.create` before proceeding. */
export function requireReturnsCreate(authorization, permissions) {
    authorization.requirePermission(permissions, 'returns.create');
}
/** Ensures the actor holds `returns.update` before proceeding. */
export function requireReturnsUpdate(authorization, permissions) {
    authorization.requirePermission(permissions, 'returns.update');
}
