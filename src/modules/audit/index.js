import { DefaultAuthorizationService } from '../authorization/public/index.js';
import { AuditService } from './application/audit-service.js';
import { DefaultAuditRecorder } from './application/default-audit-recorder.js';
import { PostgresAuditRepository } from './infrastructure/postgres-audit-repository.js';
import auditRoutes from './presentation/audit.routes.js';
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
