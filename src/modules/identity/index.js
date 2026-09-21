import { Argon2PasswordHasher } from '../../infrastructure/auth/argon2-password-hasher.js';
import { JoseAccessTokenService } from '../../infrastructure/auth/jose-access-token-service.js';
import { AesSecretEncryptor } from '../../infrastructure/auth/aes-secret-encryptor.js';
import { CreateUserUseCase } from './application/use-cases/create-user.js';
import { GetUserUseCase } from './application/use-cases/get-user.js';
import { AddMembershipUseCase } from './application/use-cases/add-membership.js';
import { GetMembershipUseCase } from './application/use-cases/get-membership.js';
import { ActivateMembershipUseCase } from './application/use-cases/activate-membership.js';
import { SuspendMembershipUseCase } from './application/use-cases/suspend-membership.js';
import { RevokeMembershipUseCase } from './application/use-cases/revoke-membership.js';
import { LoginUseCase } from './application/use-cases/login.js';
import { RefreshTokenUseCase } from './application/use-cases/refresh-token.js';
import { LogoutUseCase } from './application/use-cases/logout.js';
import { GetCurrentUserUseCase } from './application/use-cases/get-current-user.js';
import { RequestPasswordResetUseCase } from './application/use-cases/request-password-reset.js';
import { ConfirmPasswordResetUseCase } from './application/use-cases/confirm-password-reset.js';
import { PostgresUserRepository } from './infrastructure/postgres-user-repository.js';
import { PostgresMembershipRepository } from './infrastructure/postgres-membership-repository.js';
import { PostgresPasswordCredentialRepository } from './infrastructure/postgres-password-credential-repository.js';
import { PostgresRefreshSessionRepository } from './infrastructure/postgres-refresh-session-repository.js';
import { PostgresPasswordResetTokenRepository } from './infrastructure/postgres-password-reset-token-repository.js';
import { PostgresTenantLookup } from './infrastructure/postgres-tenant-lookup.js';
import { NoopPasswordResetNotifier } from './infrastructure/noop-password-reset-notifier.js';
import { createAuthRoutes } from './presentation/auth.routes.js';
export async function createIdentityModule(deps) {
    const passwordHasher = new Argon2PasswordHasher();
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
            ...(deps.auditRecorder === undefined ? {} : { auditRecorder: deps.auditRecorder }),
            ...authDeps,
        }),
        refreshToken: new RefreshTokenUseCase({
            db: deps.database,
            refreshSessions,
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
        }),
        confirmPasswordReset: new ConfirmPasswordResetUseCase({
            db: deps.database,
            resetTokens,
            credentials,
            refreshSessions,
            passwordHasher,
            passwordPolicy,
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
