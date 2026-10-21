/**
 * Application service for querying tenant-scoped audit events.
 * @param {{
 *   repository: { list: Function },
 *   database: { execute: Function },
 *   requirePermission: (granted: string[], required: string) => void,
 * }} deps
 * @returns {{ listEvents: Function }}
 */
export function createAuditService(deps) {
    /**
     * @param {{
     *   tenantId: string,
     *   actorPermissions: string[],
     *   eventType?: string,
     *   limit?: number,
     *   offset?: number,
     * }} input
     */
    async function listEvents(input) {
        deps.requirePermission(input.actorPermissions, 'audit.read');
        return deps.database.execute(
            async (tx) =>
                deps.repository.list(tx, {
                    tenantId: input.tenantId,
                    ...(input.eventType === undefined ? {} : { eventType: input.eventType }),
                    ...(input.limit === undefined ? {} : { limit: input.limit }),
                    ...(input.offset === undefined ? {} : { offset: input.offset }),
                }),
            { tenantId: input.tenantId },
        );
    }

    return { listEvents };
}
