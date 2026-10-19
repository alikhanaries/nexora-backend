export function requireOffersRead(authorization, permissions) {
    authorization.requirePermission(permissions, 'offers.read');
}
export function requireOffersCreate(authorization, permissions) {
    authorization.requirePermission(permissions, 'offers.create');
}
export function requireOffersUpdate(authorization, permissions) {
    authorization.requirePermission(permissions, 'offers.update');
}
