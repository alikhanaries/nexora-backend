import { auditRequestFields } from '../../../audit/public/index.js';
import { Email, InvalidCredentialsError, RefreshSession } from '../../domain/index.js';
import { normalizeTenantSlug, validateTenantSlug } from '../../../../shared/security/index.js';
import { createRefreshSessionDraft } from '../auth-tokens.js';
export class LoginUseCase {
    deps;
    constructor(deps) {
        this.deps = deps;
    }
    async execute(input) {
        validateTenantSlug(input.tenantSlug);
        const tenantSlug = normalizeTenantSlug(input.tenantSlug);
        let email;
        try {
            email = Email.create(input.email);
        }
        catch {
            await this.recordFailure(undefined);
            throw new InvalidCredentialsError();
        }
        const authContext = await this.deps.db.execute(async (tx) => {
            const tenant = await this.deps.tenants.findBySlug(tx, tenantSlug);
            if (tenant === null || tenant.status !== 'ACTIVE') {
                await this.recordFailure(undefined, tx);
                throw new InvalidCredentialsError();
            }
            const user = await this.deps.users.findByNormalizedEmail(tx, email.normalized);
            if (user === null || !user.canAuthenticate()) {
                throw new InvalidCredentialsError();
            }
            const passwordHash = await this.deps.credentials.findHashByUserId(tx, user.id);
            if (passwordHash === null) {
                throw new InvalidCredentialsError();
            }
            const passwordValid = await this.deps.passwordHasher.verify(input.password, passwordHash);
            if (!passwordValid) {
                throw new InvalidCredentialsError();
            }
            return { tenant, user };
        });
        return this.deps.db.execute(async (tx) => {
            const membership = await this.deps.memberships.findByTenantAndUser(tx, authContext.tenant.id, authContext.user.id);
            if (membership === null || !membership.grantsAccess()) {
                throw new InvalidCredentialsError();
            }
            const { refreshToken, session: sessionDraft } = createRefreshSessionDraft({ userId: authContext.user.id, tenantId: authContext.tenant.id }, this.deps.refreshTokenTtlSeconds);
            const session = RefreshSession.create(sessionDraft);
            await this.deps.refreshSessions.save(tx, session);
            const accessToken = await this.deps.accessTokenService.sign({
                sub: authContext.user.id,
                tenantId: authContext.tenant.id,
                sessionId: session.id,
                tokenVersion: 1,
            });
            await this.deps.auditRecorder?.record(tx, {
                tenantId: authContext.tenant.id,
                actorKind: 'user',
                actorId: authContext.user.id,
                eventType: 'LOGIN_SUCCESS',
                resourceType: 'user',
                resourceId: authContext.user.id,
                ...auditRequestFields(),
            });
            return {
                accessToken,
                refreshToken,
                expiresIn: this.deps.accessTokenTtlSeconds,
            };
        }, { tenantId: authContext.tenant.id });
    }
    async recordFailure(tenantId, tx) {
        const event = {
            tenantId: tenantId ?? null,
            actorKind: 'system',
            eventType: 'LOGIN_FAILURE',
            ...auditRequestFields(),
        };
        if (tx !== undefined) {
            await this.deps.auditRecorder?.record(tx, event);
            return;
        }
        if (tenantId !== undefined) {
            await this.deps.db.execute(async (innerTx) => {
                await this.deps.auditRecorder?.record(innerTx, event);
            }, { tenantId });
        }
    }
}
