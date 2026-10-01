import { createAuditModule } from '../../modules/audit/index.js';
import { createAuthorizationModule } from '../../modules/authorization/index.js';
import { AuthorizationMembershipPermissionResolver } from '../../modules/authorization/public/index.js';
import { PostgresMembershipRoleRepository } from '../../modules/authorization/infrastructure/postgres-membership-role-repository.js';
import { createIdentityModule } from '../../modules/identity/index.js';
import { AuthenticateAccessTokenUseCase } from '../../modules/identity/application/authenticate-access-token.js';
import { createApiKeysModule } from '../../modules/api-keys/index.js';
import { createMfaModule } from '../../modules/mfa/index.js';
import { createTenantsModule } from '../../modules/tenants/index.js';

/**
 * Wire core domain modules using the same factories as the Fastify application.
 *
 * @param {ReturnType<import('../../app/config/index.js').loadConfigFromEnvironment>} config
 * @param {NonNullable<Awaited<ReturnType<import('./create-nest-infrastructure.js').createNestInfrastructure>>['database']>} database
 * @param {{ rateLimiter?: object | null, metrics: object }} deps
 */
export async function wireCoreDomain(config, database, deps) {
  const audit = createAuditModule({ database });
  const authorization = createAuthorizationModule({ database });
  const membershipRoles = new PostgresMembershipRoleRepository();
  const membershipPermissions = new AuthorizationMembershipPermissionResolver(membershipRoles);

  const identity = await createIdentityModule({
    database,
    config,
    rateLimiter: deps.rateLimiter ?? undefined,
    auditRecorder: audit.auditRecorder,
    membershipPermissionResolver: membershipPermissions,
  });

  const mfa = createMfaModule({
    database,
    config,
    secretEncryptor: identity.auth.secretEncryptor,
    rateLimiter: deps.rateLimiter ?? undefined,
    auditRecorder: audit.auditRecorder,
  });

  const apiKeys = createApiKeysModule({
    database,
    rateLimiter: deps.rateLimiter ?? undefined,
    stepUpVerifier: mfa.stepUpService,
    auditRecorder: audit.auditRecorder,
  });

  const tenants = createTenantsModule({
    queryable: database,
    transactionManager: database,
  });

  const authenticateAccessToken = new AuthenticateAccessTokenUseCase({
    db: database,
    accessTokenService: identity.auth.accessTokenService,
    refreshSessions: identity.repositories.refreshSessions,
    users: identity.repositories.users,
    membershipPermissions,
  });

  return {
    identity,
    tenants,
    authorization,
    audit,
    apiKeys,
    mfa,
    authenticateAccessToken,
    verifyApiKey: apiKeys.useCases.verifyApiKey,
    metrics: deps.metrics,
  };
}
