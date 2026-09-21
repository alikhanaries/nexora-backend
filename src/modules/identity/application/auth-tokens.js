import { randomUUID } from 'node:crypto';
import { generateSecureToken, hashSecret } from '../../../shared/security/index.js';
const TOKEN_VERSION = 1;
export function createRefreshSessionDraft(input, refreshTokenTtlSeconds) {
    const refreshToken = generateSecureToken(32);
    const tokenHash = hashSecret(refreshToken);
    const familyId = input.familyId ?? randomUUID();
    const id = randomUUID();
    const now = new Date();
    const expiresAt = new Date(now.getTime() + refreshTokenTtlSeconds * 1_000);
    return {
        refreshToken,
        session: {
            id,
            userId: input.userId,
            tenantId: input.tenantId,
            tokenHash,
            familyId,
            status: 'ACTIVE',
            expiresAt,
            createdAt: now,
            lastUsedAt: null,
            revokedAt: null,
            replacedBy: null,
        },
    };
}
export async function issueTokenPair(deps, input) {
    const accessToken = await deps.accessTokenService.sign({
        sub: input.userId,
        tenantId: input.tenantId,
        sessionId: input.sessionId,
        tokenVersion: TOKEN_VERSION,
    });
    const refreshDraft = createRefreshSessionDraft({
        userId: input.userId,
        tenantId: input.tenantId,
        ...(input.familyId === undefined ? {} : { familyId: input.familyId }),
    }, deps.refreshTokenTtlSeconds);
    return { accessToken, refreshDraft };
}
