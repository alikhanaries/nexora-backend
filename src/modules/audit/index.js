import { DefaultAuthorizationService } from '../authorization/public/index.js';
import { AuditService } from './services/audit-service.js';
import { DefaultAuditRecorder } from './services/default-audit-recorder.js';
import { PostgresAuditRepository } from './repositories/postgres-audit-repository.js';
import auditRoutes from './views/audit.routes.js';
export function createAuditModule(deps) {
    const repository = new PostgresAuditRepository();
    const auditRecorder = new DefaultAuditRecorder(repository);
    const authorization = new DefaultAuthorizationService();
    const auditService = new AuditService({
        repository,
        database: deps.database,
        requirePermission: (granted, required) => authorization.requirePermission(granted, required),
    });
    return {
        auditRecorder,
        auditService,
        routes: {
            plugin: auditRoutes,
            options: { auditService },
        },
    };
}
