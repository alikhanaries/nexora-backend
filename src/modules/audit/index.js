/**
 * Audit domain: append-only audit recording and permission-guarded audit log queries.
 */
import { createDefaultAuthorizationService } from '../authorization/public/index.js';
import { createAuditService } from './services/audit-service.js';
import { createDefaultAuditRecorder } from './services/default-audit-recorder.js';
import { createPostgresAuditRepository } from './repositories/postgres-audit-repository.js';

/**
 * @param {object} deps
 * @param {import('../../infrastructure/postgres/postgres-database.js').PostgresDatabase} deps.database
 * @returns {{ auditRecorder: import('./services/default-audit-recorder.js').DefaultAuditRecorder, auditService: import('./services/audit-service.js').AuditService }}
 */
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
