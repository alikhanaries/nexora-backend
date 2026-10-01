import { Inject, Injectable } from '@nestjs/common';
import { requireActorContext } from '../../shared/context/require-principal.js';
import { CORE_DOMAIN } from '../domain/core-domain.tokens.js';

function toApiKeySummary(key) {
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

export @Injectable()
class ApiKeysService {
  constructor(@Inject(CORE_DOMAIN) coreDomain) {
    this.coreDomain = coreDomain;
  }

  get useCases() {
    return this.coreDomain.apiKeys.useCases;
  }

  async listApiKeys() {
    const actor = requireActorContext();
    const keys = await this.useCases.listApiKeys.execute({
      tenantId: actor.tenantId,
      actorPermissions: actor.permissions,
    });
    return keys.map(toApiKeySummary);
  }

  async createApiKey(body) {
    const actor = requireActorContext();
    const result = await this.useCases.createApiKey.execute({
      tenantId: actor.tenantId,
      actorId: actor.userId ?? actor.tenantId,
      actorPermissions: actor.permissions,
      name: body.name,
      scopes: body.scopes,
      ...(body.keyType === undefined ? {} : { keyType: body.keyType }),
      expiresAt: body.expiresAt === undefined ? null : new Date(body.expiresAt),
    });
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

  async rotateApiKey(apiKeyId) {
    const actor = requireActorContext();
    if (actor.sessionId === undefined) {
      throw new Error('Session is required for API key rotation');
    }
    return this.useCases.rotateApiKey.execute({
      tenantId: actor.tenantId,
      actorId: actor.userId ?? actor.tenantId,
      actorPermissions: actor.permissions,
      sessionId: actor.sessionId,
      apiKeyId,
    });
  }

  async revokeApiKey(apiKeyId) {
    const actor = requireActorContext();
    await this.useCases.revokeApiKey.execute({
      tenantId: actor.tenantId,
      actorId: actor.userId ?? actor.tenantId,
      actorPermissions: actor.permissions,
      apiKeyId,
    });
  }
}
