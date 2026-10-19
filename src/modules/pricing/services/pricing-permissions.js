export function requirePricingRead(authorization, permissions) {
    authorization.requirePermission(permissions, 'pricing.read');
}
export function requirePricingCreate(authorization, permissions) {
    authorization.requirePermission(permissions, 'pricing.create');
}
export function requirePricingUpdate(authorization, permissions) {
    authorization.requirePermission(permissions, 'pricing.update');
}
