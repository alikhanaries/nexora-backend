/**
 * Authorization gate for cancellation reads (`cancellations.read`).
 * @param {import('../../authorization/public/index.js').AuthorizationService} authorization
 * @param {string[]} permissions Actor permission list from the request context.
 */
export function requireCancellationsRead(authorization, permissions) {
    authorization.requirePermission(permissions, 'cancellations.read');
}
/**
 * Authorization gate for direct cancellation API creates (`cancellations.create`).
 * @param {import('../../authorization/public/index.js').AuthorizationService} authorization
 * @param {string[]} permissions Actor permission list.
 */
export function requireCancellationsCreate(authorization, permissions) {
    authorization.requirePermission(permissions, 'cancellations.create');
}
/**
 * Authorization gate for order-scoped cancel flows (`orders.cancel`).
 * @param {import('../../authorization/public/index.js').AuthorizationService} authorization
 * @param {string[]} permissions Actor permission list.
 */
export function requireOrdersCancel(authorization, permissions) {
    authorization.requirePermission(permissions, 'orders.cancel');
}
