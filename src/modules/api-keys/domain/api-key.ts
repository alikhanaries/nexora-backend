export type ApiKeyStatus = 'ACTIVE' | 'REVOKED' | 'EXPIRED';
export type ApiKeyType = 'STANDARD' | 'INTEGRATION';

export interface ApiKey {
  readonly id: string;
  readonly tenantId: string;
  readonly name: string;
  readonly prefix: string;
  readonly secretHash: string;
  readonly keyType: ApiKeyType;
  readonly scopes: readonly string[];
  readonly status: ApiKeyStatus;
  readonly channelId: string | null;
  readonly expiresAt: Date | null;
  readonly lastUsedAt: Date | null;
  readonly createdAt: Date;
  readonly updatedAt: Date;
  readonly revokedAt: Date | null;
  readonly rotatedFromId: string | null;
}

export interface ApiKeySummary {
  readonly id: string;
  readonly tenantId: string;
  readonly name: string;
  readonly prefix: string;
  readonly keyType: ApiKeyType;
  readonly scopes: readonly string[];
  readonly status: ApiKeyStatus;
  readonly expiresAt: Date | null;
  readonly lastUsedAt: Date | null;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}

export function intersectScopesWithPermissions(
  scopes: readonly string[],
  permissions: readonly string[],
): readonly string[] {
  const allowed = new Set(permissions);
  return scopes.filter((scope) => allowed.has(scope));
}
