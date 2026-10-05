/**
 * @param {{ database?: { withTenant?: (tenantId: string, work: (tx: object) => Promise<unknown>) => Promise<unknown> }, queryable: object }} deps
 * @param {string} tenantId
 * @param {object | undefined} tx
 * @param {(queryable: object) => Promise<unknown>} work
 */
export async function withOrderQueryable(deps, tenantId, tx, work) {
    if (tx !== undefined) {
        return work(tx);
    }
    if (deps.database?.withTenant !== undefined) {
        return deps.database.withTenant(tenantId, work);
    }
    return work(deps.queryable);
}
