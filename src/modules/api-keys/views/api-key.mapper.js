/**
 * @param {object} key
 */
export function toApiKeySummary(key) {
  return {
    id: key.id,
    tenantId: key.tenantId,
    name: key.name,
    prefix: key.prefix,
    keyType: key.keyType,
    scopes: [...key.scopes],
    status: key.status,
    expiresAt: key.expiresAt?.toISOString() ?? null,
    lastUsedAt: key.lastUsedAt?.toISOString() ?? null,
    createdAt: key.createdAt.toISOString(),
    updatedAt: key.updatedAt.toISOString(),
  };
}

/**
 * @param {object} result
 */
export function toCreatedApiKeyResponse(result) {
  return {
    id: result.id,
    name: result.name,
    prefix: result.prefix,
    secret: result.secret,
    scopes: [...result.scopes],
    keyType: result.keyType,
    expiresAt: result.expiresAt?.toISOString() ?? null,
  };
}
