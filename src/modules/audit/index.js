import { createDefaultAuthorizationService } from '../authorization/public/index.js';
import { createAuditService } from './services/audit-service.js';
import { createDefaultAuditRecorder } from './services/default-audit-recorder.js';
import { createPostgresAuditRepository } from './repositories/postgres-audit-repository.js';

export function createAuditModule(deps) {
    const repository = createPostgresAuditRepository();
    const auditRecorder = createDefaultAuditRecorder(repository);
    const authorization = createDefaultAuthorizationService();
    const auditService = createAuditService({
        repository,
        database: deps.database,
        requirePermission: (granted, required) => authorization.requirePermission(granted, required),
    });
    return {
        auditRecorder,
        auditService,
    };
}
