import { Inject, Injectable } from '@nestjs/common';
import { ChannelStatus } from '../../modules/channels/domain/channel-status.js';
import { toChannelResponse } from '../../modules/channels/presentation/channel.mapper.js';
import { requireActorContext } from '../../shared/context/require-principal.js';
import { CORE_DOMAIN } from '../domain/core-domain.tokens.js';

export @Injectable()
class ChannelsService {
  constructor(@Inject(CORE_DOMAIN) coreDomain) {
    this.coreDomain = coreDomain;
  }

  get deps() {
    return this.coreDomain.channelRouteDeps;
  }

  async listChannels(query) {
    const actor = requireActorContext();
    const { channels } = await this.deps.listChannels.execute({
      tenantId: actor.tenantId,
      actorPermissions: actor.permissions,
      ...(query.status === undefined ? {} : { status: query.status }),
      ...(query.marketplaceId === undefined ? {} : { marketplaceId: query.marketplaceId }),
    });
    return channels.map(toChannelResponse);
  }

  async createChannel(body) {
    const actor = requireActorContext();
    const { channel } = await this.deps.createChannel.execute({
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
    return toChannelResponse(channel);
  }

  async getChannel(channelId) {
    const actor = requireActorContext();
    const { channel } = await this.deps.getChannel.execute({
      tenantId: actor.tenantId,
      actorPermissions: actor.permissions,
      channelId,
    });
    return toChannelResponse(channel);
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
      ({ channel } = await this.deps.updateChannel.execute({
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
      ({ channel } = await this.deps.getChannel.execute({
        tenantId: actor.tenantId,
        actorPermissions: actor.permissions,
        channelId,
      }));
    }
    if (body.status !== undefined && body.status !== channel.status) {
      if (body.status === ChannelStatus.ACTIVE) {
        ({ channel } = await this.deps.activateChannel.execute({
          tenantId: actor.tenantId,
          actorPermissions: actor.permissions,
          actorId,
          channelId,
        }));
      } else if (body.status === ChannelStatus.INACTIVE) {
        ({ channel } = await this.deps.deactivateChannel.execute({
          tenantId: actor.tenantId,
          actorPermissions: actor.permissions,
          actorId,
          channelId,
        }));
      } else {
        ({ channel } = await this.deps.suspendChannel.execute({
          tenantId: actor.tenantId,
          actorPermissions: actor.permissions,
          actorId,
          channelId,
        }));
      }
    }
    return toChannelResponse(channel);
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
