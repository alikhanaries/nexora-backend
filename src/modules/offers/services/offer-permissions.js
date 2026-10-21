/** Ensures the actor holds `offers.read` before proceeding. */
export function requireOffersRead(authorization, permissions) {
    authorization.requirePermission(permissions, 'offers.read');
}
/** Ensures the actor holds `offers.create` before proceeding. */
export function requireOffersCreate(authorization, permissions) {
    authorization.requirePermission(permissions, 'offers.create');
}
/** Ensures the actor holds `offers.update` before proceeding. */
export function requireOffersUpdate(authorization, permissions) {
    authorization.requirePermission(permissions, 'offers.update');
}
