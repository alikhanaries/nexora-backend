import { Body, Controller, Get, HttpCode, Inject, Param, Post } from '@nestjs/common';
import { parseOrThrow } from '../../shared/validation/index.js';
import { apiKeyIdParamsSchema, createApiKeyBodySchema } from './api-keys.schemas.js';
import { ApiKeysService } from './api-keys.service.js';

export @Controller()
class ApiKeysController {
  constructor(@Inject(ApiKeysService) apiKeysService) {
    this.apiKeysService = apiKeysService;
  }

  @Get('/api/v1/api-keys')
  async list() {
    const data = await this.apiKeysService.listApiKeys();
    return { success: true, data };
  }

  @Post('/api/v1/api-keys')
  @HttpCode(201)
  async create(@Body() body) {
    const parsed = parseOrThrow(createApiKeyBodySchema, body, 'create api key');
    const data = await this.apiKeysService.createApiKey(parsed);
    return { success: true, data };
  }

  @Post('/api/v1/api-keys/:apiKeyId/rotate')
  @HttpCode(200)
  async rotate(@Param() params) {
    const { apiKeyId } = parseOrThrow(apiKeyIdParamsSchema, params, 'api key params');
    const data = await this.apiKeysService.rotateApiKey(apiKeyId);
    return { success: true, data };
  }

  @Post('/api/v1/api-keys/:apiKeyId/revoke')
  @HttpCode(200)
  async revoke(@Param() params) {
    const { apiKeyId } = parseOrThrow(apiKeyIdParamsSchema, params, 'api key params');
    await this.apiKeysService.revokeApiKey(apiKeyId);
    return { success: true, data: { revoked: true } };
  }
}
