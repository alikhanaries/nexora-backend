import { createArgon2PasswordHasher } from '../../infrastructure/auth/argon2-password-hasher.js';
import { JoseAccessTokenService } from '../../infrastructure/auth/jose-access-token-service.js';
import { AesSecretEncryptor } from '../../infrastructure/auth/aes-secret-encryptor.js';
import { createCreateUser } from './services/use-cases/create-user.js';
import { createGetUser } from './services/use-cases/get-user.js';
import { createAddMembership } from './services/use-cases/add-membership.js';
import { createGetMembership } from './services/use-cases/get-membership.js';
import { createActivateMembership } from './services/use-cases/activate-membership.js';
import { createSuspendMembership } from './services/use-cases/suspend-membership.js';
import { createRevokeMembership } from './services/use-cases/revoke-membership.js';
import { createLogin } from './services/use-cases/login.js';
import { createRefreshToken } from './services/use-cases/refresh-token.js';
import { createLogout } from './services/use-cases/logout.js';
import { createGetCurrentUser } from './services/use-cases/get-current-user.js';
import { createRequestPasswordReset } from './services/use-cases/request-password-reset.js';
import { createConfirmPasswordReset } from './services/use-cases/confirm-password-reset.js';
import { createAuthenticateAccessToken } from './services/authenticate-access-token.js';
import { createPostgresUserRepository } from './repositories/postgres-user-repository.js';
import { createPostgresMembershipRepository } from './repositories/postgres-membership-repository.js';
import { createPostgresPasswordCredentialRepository } from './repositories/postgres-password-credential-repository.js';
import { createPostgresRefreshSessionRepository } from './repositories/postgres-refresh-session-repository.js';
import { createPostgresPasswordResetTokenRepository } from './repositories/postgres-password-reset-token-repository.js';
import { createPostgresTenantLookup } from './repositories/postgres-tenant-lookup.js';
import { createNoopPasswordResetNotifier } from './repositories/noop-password-reset-notifier.js';

export async function createIdentityModule(deps) {
    const passwordHasher = createArgon2PasswordHasher();
    const accessTokenService = await JoseAccessTokenService.create(deps.config.auth);
    const secretEncryptor = new AesSecretEncryptor(deps.config.auth.mfaEncryptionKey);
    const users = createPostgresUserRepository();
    const memberships = createPostgresMembershipRepository();
    const credentials = createPostgresPasswordCredentialRepository();
    const refreshSessions = createPostgresRefreshSessionRepository();
    const resetTokens = createPostgresPasswordResetTokenRepository();
    const tenants = createPostgresTenantLookup();
    const resetNotifier = createNoopPasswordResetNotifier();
    const passwordPolicy = {
        minLength: deps.config.auth.passwordMinLength,
        maxLength: deps.config.auth.passwordMaxLength,
    };
    const authDeps = {
        accessTokenService,
        accessTokenTtlSeconds: deps.config.auth.accessTokenTtlSeconds,
        refreshTokenTtlSeconds: deps.config.auth.refreshTokenTtlSeconds,
    };
    const useCases = {
        createUser: createCreateUser({
            db: deps.database,
            users,
            credentials,
            passwordHasher,
            passwordPolicy,
        }),
        getUser: createGetUser({ db: deps.database, users }),
        addMembership: createAddMembership({ db: deps.database, users, memberships }),
        getMembership: createGetMembership({ db: deps.database, memberships }),
        activateMembership: createActivateMembership({ db: deps.database, memberships }),
        suspendMembership: createSuspendMembership({ db: deps.database, memberships }),
        revokeMembership: createRevokeMembership({ db: deps.database, memberships }),
        login: createLogin({
            db: deps.database,
            tenants,
            users,
            credentials,
            memberships,
            refreshSessions,
            passwordHasher,
            ...(deps.rateLimiter === undefined ? {} : { rateLimiter: deps.rateLimiter }),
            ...(deps.auditRecorder === undefined ? {} : { auditRecorder: deps.auditRecorder }),
            ...authDeps,
        }),
        refreshToken: createRefreshToken({
            db: deps.database,
            refreshSessions,
            ...(deps.rateLimiter === undefined ? {} : { rateLimiter: deps.rateLimiter }),
            ...(deps.auditRecorder === undefined ? {} : { auditRecorder: deps.auditRecorder }),
            ...authDeps,
        }),
        logout: createLogout({ db: deps.database, refreshSessions }),
        getCurrentUser: createGetCurrentUser({
            db: deps.database,
            accessTokenService,
            users,
            memberships,
            refreshSessions,
        }),
        requestPasswordReset: createRequestPasswordReset({
            db: deps.database,
            users,
            resetTokens,
            notifier: resetNotifier,
            ...(deps.rateLimiter === undefined ? {} : { rateLimiter: deps.rateLimiter }),
        }),
        confirmPasswordReset: createConfirmPasswordReset({
            db: deps.database,
            resetTokens,
            credentials,
            refreshSessions,
            passwordHasher,
            passwordPolicy,
            ...(deps.rateLimiter === undefined ? {} : { rateLimiter: deps.rateLimiter }),
        }),
    };
    const authenticateAccessToken = createAuthenticateAccessToken({
        db: deps.database,
        accessTokenService,
        refreshSessions,
        users,
        membershipPermissions: deps.membershipPermissionResolver,
    });
    return {
        useCases,
        authenticateAccessToken,
        auth: { passwordHasher, accessTokenService, secretEncryptor },
        repositories: { users, refreshSessions },
    };
}
