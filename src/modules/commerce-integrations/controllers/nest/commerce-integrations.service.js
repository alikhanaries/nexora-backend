import { Inject, Injectable } from '@nestjs/common';
import { IntegrationStatus } from '../../models/integration-status.js';
import { toCommerceIntegrationResponse } from '../../views/commerce-integration.mapper.js';
import { requireActorContext } from '../../../../shared/context/require-principal.js';
import { CORE_SERVICES } from '../../../../app/di/core-services.tokens.js';

export @Injectable()
class CommerceIntegrationsService {
  constructor(@Inject(CORE_SERVICES) coreServices) {
    this.coreServices = coreServices;
  }

  get deps() {
    return this.coreServices.channelRouteDeps;
  }

  async listCommerceIntegrations(query) {
    const actor = requireActorContext();
    const { channels } = await this.deps.listCommerceIntegrations.execute({
      tenantId: actor.tenantId,
      actorPermissions: actor.permissions,
      ...(query.status === undefined ? {} : { status: query.status }),
      ...(query.marketplaceId === undefined ? {} : { marketplaceId: query.marketplaceId }),
    });
    return channels.map(toCommerceIntegrationResponse);
  }

  async createCommerceIntegration(body) {
    const actor = requireActorContext();
    const { channel } = await this.deps.createCommerceIntegration.execute({
      tenantId: actor.tenantId,
      actorPermissions: actor.permissions,
      marketplaceId: body.marketplaceId,
      name: body.name,
      ...(body.externalReference === undefined ? {} : { externalReference: body.externalReference }),
      ...(body.configurationReference === undefined
        ? {}
        : { configurationReference: body.configurationReference }),
      ...(body.defaultStockLocationId === undefined
        ? {}
        : { defaultStockLocationId: body.defaultStockLocationId }),
    });
    return toCommerceIntegrationResponse(channel);
  }

  async getCommerceIntegration(channelId) {
    const actor = requireActorContext();
    const { channel } = await this.deps.getCommerceIntegration.execute({
      tenantId: actor.tenantId,
      actorPermissions: actor.permissions,
      channelId,
    });
    return toCommerceIntegrationResponse(channel);
  }

  async patchChannel(channelId, body) {
    const actor = requireActorContext();
    const actorId = actor.userId ?? actor.tenantId;
    let channel;
    if (
      body.name !== undefined ||
      body.externalReference !== undefined ||
      body.configurationReference !== undefined ||
      body.defaultStockLocationId !== undefined
    ) {
      ({ channel } = await this.deps.updateCommerceIntegration.execute({
        tenantId: actor.tenantId,
        actorPermissions: actor.permissions,
        channelId,
        ...(body.name === undefined ? {} : { name: body.name }),
        ...(body.externalReference === undefined ? {} : { externalReference: body.externalReference }),
        ...(body.configurationReference === undefined
          ? {}
          : { configurationReference: body.configurationReference }),
        ...(body.defaultStockLocationId === undefined
          ? {}
          : { defaultStockLocationId: body.defaultStockLocationId }),
      }));
    } else {
      ({ channel } = await this.deps.getCommerceIntegration.execute({
        tenantId: actor.tenantId,
        actorPermissions: actor.permissions,
        channelId,
      }));
    }
    if (body.status !== undefined && body.status !== channel.status) {
      if (body.status === IntegrationStatus.ACTIVE) {
        ({ channel } = await this.deps.activateCommerceIntegration.execute({
          tenantId: actor.tenantId,
          actorPermissions: actor.permissions,
          actorId,
          channelId,
        }));
      } else if (body.status === IntegrationStatus.INACTIVE) {
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
    return toCommerceIntegrationResponse(channel);
  }

  async upsertMarketplaceConnection(channelId, body) {
    const actor = requireActorContext();
    const { connection } = await this.deps.upsertMarketplaceConnection.execute({
      tenantId: actor.tenantId,
      actorPermissions: actor.permissions,
      actorId: actor.userId ?? actor.tenantId,
      channelId,
      credentials: body.credentials,
      ...(body.configuration === undefined ? {} : { configuration: body.configuration }),
    });
    return connection;
  }

  async getMarketplaceConnection(channelId) {
    const actor = requireActorContext();
    const { connection } = await this.deps.getMarketplaceConnection.execute({
      tenantId: actor.tenantId,
      actorPermissions: actor.permissions,
      channelId,
    });
    return connection;
  }

  async patchMarketplaceConnection(channelId, body) {
    const actor = requireActorContext();
    const { connection } = await this.deps.patchMarketplaceConnection.execute({
      tenantId: actor.tenantId,
      actorPermissions: actor.permissions,
      actorId: actor.userId ?? actor.tenantId,
      channelId,
      ...(body.credentials === undefined ? {} : { credentials: body.credentials }),
      ...(body.configuration === undefined ? {} : { configuration: body.configuration }),
    });
    return connection;
  }

  async deleteMarketplaceConnection(channelId) {
    const actor = requireActorContext();
    await this.deps.deleteMarketplaceConnection.execute({
      tenantId: actor.tenantId,
      actorPermissions: actor.permissions,
      actorId: actor.userId ?? actor.tenantId,
      channelId,
    });
  }

  async testMarketplaceConnection(channelId) {
    const actor = requireActorContext();
    await this.deps.testMarketplaceConnection.execute({
      tenantId: actor.tenantId,
      actorPermissions: actor.permissions,
      actorId: actor.userId ?? actor.tenantId,
      channelId,
    });
  }
}
