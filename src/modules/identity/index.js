import { createArgon2PasswordHasher } from '../../infrastructure/auth/argon2-password-hasher.js';
import { JoseAccessTokenService } from '../../infrastructure/auth/jose-access-token-service.js';
import { AesSecretEncryptor } from '../../infrastructure/auth/aes-secret-encryptor.js';
import { CreateUserUseCase } from './services/use-cases/create-user.js';
import { GetUserUseCase } from './services/use-cases/get-user.js';
import { AddMembershipUseCase } from './services/use-cases/add-membership.js';
import { GetMembershipUseCase } from './services/use-cases/get-membership.js';
import { ActivateMembershipUseCase } from './services/use-cases/activate-membership.js';
import { SuspendMembershipUseCase } from './services/use-cases/suspend-membership.js';
import { RevokeMembershipUseCase } from './services/use-cases/revoke-membership.js';
import { LoginUseCase } from './services/use-cases/login.js';
import { RefreshTokenUseCase } from './services/use-cases/refresh-token.js';
import { LogoutUseCase } from './services/use-cases/logout.js';
import { GetCurrentUserUseCase } from './services/use-cases/get-current-user.js';
import { RequestPasswordResetUseCase } from './services/use-cases/request-password-reset.js';
import { ConfirmPasswordResetUseCase } from './services/use-cases/confirm-password-reset.js';
import { PostgresUserRepository } from './repositories/postgres-user-repository.js';
import { PostgresMembershipRepository } from './repositories/postgres-membership-repository.js';
import { PostgresPasswordCredentialRepository } from './repositories/postgres-password-credential-repository.js';
import { PostgresRefreshSessionRepository } from './repositories/postgres-refresh-session-repository.js';
import { PostgresPasswordResetTokenRepository } from './repositories/postgres-password-reset-token-repository.js';
import { PostgresTenantLookup } from './repositories/postgres-tenant-lookup.js';
import { NoopPasswordResetNotifier } from './repositories/noop-password-reset-notifier.js';
import { createAuthRoutes } from './views/auth.routes.js';
export async function createIdentityModule(deps) {
    const passwordHasher = createArgon2PasswordHasher();
    const accessTokenService = await JoseAccessTokenService.create(deps.config.auth);
    const secretEncryptor = new AesSecretEncryptor(deps.config.auth.mfaEncryptionKey);
    const users = new PostgresUserRepository();
    const memberships = new PostgresMembershipRepository();
    const credentials = new PostgresPasswordCredentialRepository();
    const refreshSessions = new PostgresRefreshSessionRepository();
    const resetTokens = new PostgresPasswordResetTokenRepository();
    const tenants = new PostgresTenantLookup();
    const resetNotifier = new NoopPasswordResetNotifier();
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
        createUser: new CreateUserUseCase({
            db: deps.database,
            users,
            credentials,
            passwordHasher,
            passwordPolicy,
        }),
        getUser: new GetUserUseCase({ db: deps.database, users }),
        addMembership: new AddMembershipUseCase({ db: deps.database, users, memberships }),
        getMembership: new GetMembershipUseCase({ db: deps.database, memberships }),
        activateMembership: new ActivateMembershipUseCase({ db: deps.database, memberships }),
        suspendMembership: new SuspendMembershipUseCase({ db: deps.database, memberships }),
        revokeMembership: new RevokeMembershipUseCase({ db: deps.database, memberships }),
        login: new LoginUseCase({
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
        refreshToken: new RefreshTokenUseCase({
            db: deps.database,
            refreshSessions,
            ...(deps.rateLimiter === undefined ? {} : { rateLimiter: deps.rateLimiter }),
            ...(deps.auditRecorder === undefined ? {} : { auditRecorder: deps.auditRecorder }),
            ...authDeps,
        }),
        logout: new LogoutUseCase({ db: deps.database, refreshSessions }),
        getCurrentUser: new GetCurrentUserUseCase({
            db: deps.database,
            accessTokenService,
            users,
            memberships,
            refreshSessions,
        }),
        requestPasswordReset: new RequestPasswordResetUseCase({
            db: deps.database,
            users,
            resetTokens,
            notifier: resetNotifier,
            ...(deps.rateLimiter === undefined ? {} : { rateLimiter: deps.rateLimiter }),
        }),
        confirmPasswordReset: new ConfirmPasswordResetUseCase({
            db: deps.database,
            resetTokens,
            credentials,
            refreshSessions,
            passwordHasher,
            passwordPolicy,
            ...(deps.rateLimiter === undefined ? {} : { rateLimiter: deps.rateLimiter }),
        }),
    };
    const authRoutes = createAuthRoutes({
        login: useCases.login,
        refreshToken: useCases.refreshToken,
        logout: useCases.logout,
        getCurrentUser: useCases.getCurrentUser,
    });
    return {
        useCases,
        auth: { passwordHasher, accessTokenService, secretEncryptor },
        routes: { auth: authRoutes },
        repositories: { users, refreshSessions },
    };
}
