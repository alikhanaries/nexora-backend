import { Body, Controller, Get, HttpCode, Inject, Param, Post } from '@nestjs/common';
import { parseOrThrow } from '../../../../shared/validation/index.js';
import { requireActorContext } from '../../../../shared/context/require-principal.js';
import { AuthenticationError } from '../../../../shared/errors/index.js';
import { CORE_SERVICES } from '../../../../app/di/core-services.tokens.js';
import { API_KEY_ROUTES } from '../../routes/api-key.routes.js';
import { apiKeyIdParamsSchema, createApiKeyBodySchema } from '../../views/api-key.schemas.js';
import { toApiKeySummary, toCreatedApiKeyResponse } from '../../views/api-key.mapper.js';

/**
 * Thin Nest HTTP adapter — API methods only.
 */
@Controller()
class ApiKeysController {
  constructor(@Inject(CORE_SERVICES) coreServices) {
    this.useCases = coreServices.apiKeys.useCases;
  }

  @Get(API_KEY_ROUTES.list.path)
  async list() {
    const actor = requireActorContext();
    const keys = await this.useCases.listApiKeys.execute({
      tenantId: actor.tenantId,
      actorPermissions: actor.permissions,
    });
    return { success: true, data: keys.map(toApiKeySummary) };
  }

  @Post(API_KEY_ROUTES.create.path)
  @HttpCode(201)
  async create(@Body() body) {
    const parsed = parseOrThrow(createApiKeyBodySchema, body, 'create api key');
    const actor = requireActorContext();
    const result = await this.useCases.createApiKey.execute({
      tenantId: actor.tenantId,
      actorId: actor.userId ?? actor.tenantId,
      actorPermissions: actor.permissions,
      name: parsed.name,
      scopes: parsed.scopes,
      ...(parsed.keyType === undefined ? {} : { keyType: parsed.keyType }),
      expiresAt: parsed.expiresAt === undefined ? null : new Date(parsed.expiresAt),
    });
    return { success: true, data: toCreatedApiKeyResponse(result) };
  }

  @Post(API_KEY_ROUTES.rotate.path)
  @HttpCode(200)
  async rotate(@Param() params) {
    const { apiKeyId } = parseOrThrow(apiKeyIdParamsSchema, params, 'api key params');
    const actor = requireActorContext();
    if (actor.sessionId === undefined) {
      throw new AuthenticationError('Session is required for API key rotation');
    }
    const data = await this.useCases.rotateApiKey.execute({
      tenantId: actor.tenantId,
      actorId: actor.userId ?? actor.tenantId,
      actorPermissions: actor.permissions,
      sessionId: actor.sessionId,
      apiKeyId,
    });
    return { success: true, data };
  }

  @Post(API_KEY_ROUTES.revoke.path)
  @HttpCode(200)
  async revoke(@Param() params) {
    const { apiKeyId } = parseOrThrow(apiKeyIdParamsSchema, params, 'api key params');
    const actor = requireActorContext();
    await this.useCases.revokeApiKey.execute({
      tenantId: actor.tenantId,
      actorId: actor.userId ?? actor.tenantId,
      actorPermissions: actor.permissions,
      apiKeyId,
    });
    return { success: true, data: { revoked: true } };
  }
}
export { ApiKeysController };
