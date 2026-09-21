import type { Queryable, TransactionManager } from '../../shared/persistence/index.js';
import { DefaultAuthorizationService } from '../authorization/public/index.js';
import { AuditService } from './application/audit-service.js';
import { DefaultAuditRecorder } from './application/default-audit-recorder.js';
import { PostgresAuditRepository } from './infrastructure/postgres-audit-repository.js';
import auditRoutes from './presentation/audit.routes.js';

export interface AuditModuleDependencies {
  readonly database: TransactionManager & Queryable;
}

export function createAuditModule(deps: AuditModuleDependencies) {
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

export type AuditModule = ReturnType<typeof createAuditModule>;
