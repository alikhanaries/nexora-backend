import { createAuditModule } from '../../modules/audit/index.js';
import type { AuditModule } from '../../modules/audit/index.js';
import { createApiKeysModule, type ApiKeysModule } from '../../modules/api-keys/index.js';
import { createAuthorizationModule } from '../../modules/authorization/index.js';
import type { AuthorizationModule } from '../../modules/authorization/index.js';
import { AuthorizationMembershipPermissionResolver } from '../../modules/authorization/public/index.js';
import { PostgresMembershipRoleRepository } from '../../modules/authorization/infrastructure/postgres-membership-role-repository.js';
import { createIdentityModule, type IdentityModule } from '../../modules/identity/index.js';
import { AuthenticateAccessTokenUseCase } from '../../modules/identity/application/authenticate-access-token.js';
import { createMfaModule, type MfaModule } from '../../modules/mfa/index.js';
import { createTenantsModule } from '../../modules/tenants/index.js';
import type { HttpServer } from '../http/types.js';
import { createHttpServer } from '../http/create-server.js';
import { createDefaultProbes, ReadinessService } from '../observability/readiness.js';
import type { Infrastructure } from './create-infrastructure.js';

export interface Application {
  readonly infra: Infrastructure;
  readonly identity: IdentityModule;
  readonly authorization: AuthorizationModule;
  readonly audit: AuditModule;
  readonly apiKeys: ApiKeysModule;
  readonly mfa: MfaModule;
  readonly readiness: ReadinessService;
  readonly httpServer: HttpServer;
}

export async function createApplication(infra: Infrastructure): Promise<Application> {
  const audit = createAuditModule({ database: infra.database });
  const authorization = createAuthorizationModule({ database: infra.database });

  const identity = await createIdentityModule({
    database: infra.database,
    config: infra.config,
    auditRecorder: audit.auditRecorder,
  });

  const mfa = createMfaModule({
    database: infra.database,
    config: infra.config,
    secretEncryptor: identity.auth.secretEncryptor,
    rateLimiter: infra.rateLimiter,
    auditRecorder: audit.auditRecorder,
  });

  const apiKeys = createApiKeysModule({
    database: infra.database,
    config: infra.config,
    rateLimiter: infra.rateLimiter,
    stepUpVerifier: mfa.stepUpService,
    auditRecorder: audit.auditRecorder,
  });

  const membershipRoles = new PostgresMembershipRoleRepository();
  const membershipPermissions = new AuthorizationMembershipPermissionResolver(membershipRoles);

  const authenticateAccessToken = new AuthenticateAccessTokenUseCase({
    db: infra.database,
    accessTokenService: identity.auth.accessTokenService,
    refreshSessions: identity.repositories.refreshSessions,
    users: identity.repositories.users,
    membershipPermissions,
  });

  const readiness = new ReadinessService(
    createDefaultProbes({
      database: infra.database,
      redis: infra.redis,
      queue: infra.queue,
      storage: infra.storage,
    }),
  );

  const tenants = createTenantsModule({
    queryable: infra.database,
    transactionManager: infra.database,
  });

  const httpServer = await createHttpServer({
    config: infra.config,
    logger: infra.logger,
    metrics: infra.metrics,
    readiness,
    tenants,
    identity,
    authorization,
    audit,
    apiKeys,
    mfa,
    authenticateAccessToken,
    verifyApiKey: apiKeys.useCases.verifyApiKey,
  });

  return {
    infra,
    identity,
    authorization,
    audit,
    apiKeys,
    mfa,
    readiness,
    httpServer,
  };
}
