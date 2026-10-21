import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Inject,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import {
  channelIdParamsSchema,
  createCommerceIntegrationBodySchema,
  listCommerceIntegrationsQuerySchema,
  updateCommerceIntegrationBodySchema,
} from '../../views/commerce-integration.schemas.js';
import {
  marketplaceConnectionBodySchema,
  marketplaceConnectionPatchBodySchema,
} from '../../views/marketplace-connection.schemas.js';
import { toCommerceIntegrationResponse } from '../../views/commerce-integration.mapper.js';
import { IntegrationStatus } from '../../models/integration-status.js';
import { parseOrThrow } from '../../../../shared/validation/index.js';
import { requireActorContext } from '../../../../shared/context/require-principal.js';
import { CORE_SERVICES } from '../../../../app/di/core-services.tokens.js';
import { COMMERCE_INTEGRATION_ROUTES } from '../../routes/commerce-integration.routes.js';

/**
 * Thin Nest HTTP adapter — API methods only.
 * Business rules live in services/; paths live in routes/.
 * Uses `coreServices.channelRouteDeps` (commerce-integration use cases).
 */
@Controller()
class CommerceIntegrationsController {
  constructor(@Inject(CORE_SERVICES) coreServices) {
    this.deps = coreServices.channelRouteDeps;
  }

  @Get(COMMERCE_INTEGRATION_ROUTES.list.path)
  async list(@Query() query) {
    const parsed = parseOrThrow(listCommerceIntegrationsQuerySchema, query, 'list query');
    const actor = requireActorContext();
    const { channels } = await this.deps.listCommerceIntegrations.execute({
      tenantId: actor.tenantId,
      actorPermissions: actor.permissions,
      ...(parsed.status === undefined ? {} : { status: parsed.status }),
      ...(parsed.marketplaceId === undefined ? {} : { marketplaceId: parsed.marketplaceId }),
    });
    return { success: true, data: channels.map(toCommerceIntegrationResponse) };
  }

  @Post(COMMERCE_INTEGRATION_ROUTES.create.path)
  @HttpCode(201)
  async create(@Body() body) {
    const parsed = parseOrThrow(createCommerceIntegrationBodySchema, body, 'create channel');
    const actor = requireActorContext();
    const { channel } = await this.deps.createCommerceIntegration.execute({
      tenantId: actor.tenantId,
      actorPermissions: actor.permissions,
      marketplaceId: parsed.marketplaceId,
      name: parsed.name,
      ...(parsed.externalReference === undefined
        ? {}
        : { externalReference: parsed.externalReference }),
      ...(parsed.configurationReference === undefined
        ? {}
        : { configurationReference: parsed.configurationReference }),
      ...(parsed.defaultStockLocationId === undefined
        ? {}
        : { defaultStockLocationId: parsed.defaultStockLocationId }),
    });
    return { success: true, data: toCommerceIntegrationResponse(channel) };
  }

  @Get(COMMERCE_INTEGRATION_ROUTES.getById.path)
  async getById(@Param() params) {
    const { channelId } = parseOrThrow(channelIdParamsSchema, params, 'channel params');
    const actor = requireActorContext();
    const { channel } = await this.deps.getCommerceIntegration.execute({
      tenantId: actor.tenantId,
      actorPermissions: actor.permissions,
      channelId,
    });
    return { success: true, data: toCommerceIntegrationResponse(channel) };
  }

  @Patch(COMMERCE_INTEGRATION_ROUTES.patch.path)
  @HttpCode(200)
  async patch(@Param() params, @Body() body) {
    const { channelId } = parseOrThrow(channelIdParamsSchema, params, 'channel params');
    const parsed = parseOrThrow(updateCommerceIntegrationBodySchema, body, 'update channel');
    const actor = requireActorContext();
    const actorId = actor.userId ?? actor.tenantId;
    let channel;
    if (
      parsed.name !== undefined ||
      parsed.externalReference !== undefined ||
      parsed.configurationReference !== undefined ||
      parsed.defaultStockLocationId !== undefined
    ) {
      ({ channel } = await this.deps.updateCommerceIntegration.execute({
        tenantId: actor.tenantId,
        actorPermissions: actor.permissions,
        channelId,
        ...(parsed.name === undefined ? {} : { name: parsed.name }),
        ...(parsed.externalReference === undefined
          ? {}
          : { externalReference: parsed.externalReference }),
        ...(parsed.configurationReference === undefined
          ? {}
          : { configurationReference: parsed.configurationReference }),
        ...(parsed.defaultStockLocationId === undefined
          ? {}
          : { defaultStockLocationId: parsed.defaultStockLocationId }),
      }));
    } else {
      ({ channel } = await this.deps.getCommerceIntegration.execute({
        tenantId: actor.tenantId,
        actorPermissions: actor.permissions,
        channelId,
      }));
    }
    if (parsed.status !== undefined && parsed.status !== channel.status) {
      if (parsed.status === IntegrationStatus.ACTIVE) {
        ({ channel } = await this.deps.activateCommerceIntegration.execute({
          tenantId: actor.tenantId,
          actorPermissions: actor.permissions,
          actorId,
          channelId,
        }));
      } else if (parsed.status === IntegrationStatus.INACTIVE) {
        ({ channel } = await this.deps.deactivateCommerceIntegration.execute({
          tenantId: actor.tenantId,
          actorPermissions: actor.permissions,
          actorId,
          channelId,
        }));
      } else {
        ({ channel } = await this.deps.suspendCommerceIntegration.execute({
          tenantId: actor.tenantId,
          actorPermissions: actor.permissions,
          actorId,
          channelId,
        }));
      }
    }
    return { success: true, data: toCommerceIntegrationResponse(channel) };
  }

  @Post(COMMERCE_INTEGRATION_ROUTES.upsertConnection.path)
  @HttpCode(201)
  async upsertConnection(@Param() params, @Body() body) {
    const { channelId } = parseOrThrow(channelIdParamsSchema, params, 'channel params');
    const parsed = parseOrThrow(marketplaceConnectionBodySchema, body, 'marketplace connection');
    const actor = requireActorContext();
    const { connection } = await this.deps.upsertMarketplaceConnection.execute({
      tenantId: actor.tenantId,
      actorPermissions: actor.permissions,
      actorId: actor.userId ?? actor.tenantId,
      channelId,
      credentials: parsed.credentials,
      ...(parsed.configuration === undefined ? {} : { configuration: parsed.configuration }),
    });
    return { success: true, data: connection };
  }

  @Get(COMMERCE_INTEGRATION_ROUTES.getConnection.path)
  async getConnection(@Param() params) {
    const { channelId } = parseOrThrow(channelIdParamsSchema, params, 'channel params');
    const actor = requireActorContext();
    const { connection } = await this.deps.getMarketplaceConnection.execute({
      tenantId: actor.tenantId,
      actorPermissions: actor.permissions,
      channelId,
    });
    return { success: true, data: connection };
  }

  @Patch(COMMERCE_INTEGRATION_ROUTES.patchConnection.path)
  @HttpCode(200)
  async patchConnection(@Param() params, @Body() body) {
    const { channelId } = parseOrThrow(channelIdParamsSchema, params, 'channel params');
    const parsed = parseOrThrow(
      marketplaceConnectionPatchBodySchema,
      body,
      'patch marketplace connection',
    );
    const actor = requireActorContext();
    const { connection } = await this.deps.patchMarketplaceConnection.execute({
      tenantId: actor.tenantId,
      actorPermissions: actor.permissions,
      actorId: actor.userId ?? actor.tenantId,
      channelId,
      ...(parsed.credentials === undefined ? {} : { credentials: parsed.credentials }),
      ...(parsed.configuration === undefined ? {} : { configuration: parsed.configuration }),
    });
    return { success: true, data: connection };
  }

  @Delete(COMMERCE_INTEGRATION_ROUTES.deleteConnection.path)
  @HttpCode(200)
  async deleteConnection(@Param() params) {
    const { channelId } = parseOrThrow(channelIdParamsSchema, params, 'channel params');
    const actor = requireActorContext();
    await this.deps.deleteMarketplaceConnection.execute({
      tenantId: actor.tenantId,
      actorPermissions: actor.permissions,
      actorId: actor.userId ?? actor.tenantId,
      channelId,
    });
    return { success: true };
  }

  @Post(COMMERCE_INTEGRATION_ROUTES.testConnection.path)
  @HttpCode(200)
  async testConnection(@Param() params) {
    const { channelId } = parseOrThrow(channelIdParamsSchema, params, 'channel params');
    const actor = requireActorContext();
    await this.deps.testMarketplaceConnection.execute({
      tenantId: actor.tenantId,
      actorPermissions: actor.permissions,
      actorId: actor.userId ?? actor.tenantId,
      channelId,
    });
    return { success: true };
  }
}
export { CommerceIntegrationsController };
