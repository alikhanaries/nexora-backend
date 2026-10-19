export class AuditService {
    deps;
    constructor(deps) {
        this.deps = deps;
    }
    async listEvents(input) {
        this.deps.requirePermission(input.actorPermissions, 'audit.read');
        return this.deps.database.execute(async (tx) => this.deps.repository.list(tx, {
            tenantId: input.tenantId,
            ...(input.eventType === undefined ? {} : { eventType: input.eventType }),
            ...(input.limit === undefined ? {} : { limit: input.limit }),
            ...(input.offset === undefined ? {} : { offset: input.offset }),
        }), { tenantId: input.tenantId });
    }
}
