import { randomUUID } from 'node:crypto';
import type { AccessTokenService } from '../../../shared/auth/index.js';
import { generateSecureToken, hashSecret } from '../../../shared/security/index.js';
import type { RefreshSessionProps } from '../domain/index.js';

export interface IssuedTokens {
  readonly accessToken: string;
  readonly refreshToken: string;
  readonly refreshSessionId: string;
  readonly refreshTokenHash: string;
  readonly familyId: string;
  readonly expiresAt: Date;
}

export interface TokenIssuerDeps {
  readonly accessTokenService: AccessTokenService;
  readonly accessTokenTtlSeconds: number;
  readonly refreshTokenTtlSeconds: number;
}

const TOKEN_VERSION = 1;

export function createRefreshSessionDraft(
  input: {
    readonly userId: string;
    readonly tenantId: string;
    readonly familyId?: string;
  },
  refreshTokenTtlSeconds: number,
): { session: RefreshSessionProps; refreshToken: string } {
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

export async function issueTokenPair(
  deps: TokenIssuerDeps,
  input: {
    readonly userId: string;
    readonly tenantId: string;
    readonly sessionId: string;
    readonly familyId?: string;
  },
): Promise<{ accessToken: string; refreshDraft: ReturnType<typeof createRefreshSessionDraft> }> {
  const accessToken = await deps.accessTokenService.sign({
    sub: input.userId,
    tenantId: input.tenantId,
    sessionId: input.sessionId,
    tokenVersion: TOKEN_VERSION,
  });

  const refreshDraft = createRefreshSessionDraft(
    {
      userId: input.userId,
      tenantId: input.tenantId,
      ...(input.familyId === undefined ? {} : { familyId: input.familyId }),
    },
    deps.refreshTokenTtlSeconds,
  );

  return { accessToken, refreshDraft };
}
