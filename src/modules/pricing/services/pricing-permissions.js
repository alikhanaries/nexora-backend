/** Ensures the actor holds `pricing.read` before proceeding. */
export function requirePricingRead(authorization, permissions) {
    authorization.requirePermission(permissions, 'pricing.read');
}
/** Ensures the actor holds `pricing.create` before proceeding. */
export function requirePricingCreate(authorization, permissions) {
    authorization.requirePermission(permissions, 'pricing.create');
}
/** Ensures the actor holds `pricing.update` before proceeding. */
export function requirePricingUpdate(authorization, permissions) {
    authorization.requirePermission(permissions, 'pricing.update');
}
