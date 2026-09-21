import type { FastifyPluginAsync } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { requireActorContext } from '../../../shared/context/require-principal.js';
import { ChannelStatus } from '../domain/channel-status.js';
import type { ActivateChannel } from '../application/activate-channel.js';
import type { CreateChannel } from '../application/create-channel.js';
import type { DeactivateChannel } from '../application/deactivate-channel.js';
import type { GetChannel } from '../application/get-channel.js';
import type { ListChannels } from '../application/list-channels.js';
import type { SuspendChannel } from '../application/suspend-channel.js';
import type { UpdateChannel } from '../application/update-channel.js';
import { toChannelResponse } from './channel.mapper.js';
import {
  channelIdParamsSchema,
  channelListSuccessResponseSchema,
  channelSuccessResponseSchema,
  createChannelBodySchema,
  listChannelsQuerySchema,
  updateChannelBodySchema,
} from './channel.schemas.js';

export interface ChannelRoutesDependencies {
  readonly createChannel: CreateChannel;
  readonly getChannel: GetChannel;
  readonly listChannels: ListChannels;
  readonly updateChannel: UpdateChannel;
  readonly activateChannel: ActivateChannel;
  readonly deactivateChannel: DeactivateChannel;
  readonly suspendChannel: SuspendChannel;
}

const channelRoutes: FastifyPluginAsync<ChannelRoutesDependencies> = async (app, deps) => {
  const typed = app.withTypeProvider<ZodTypeProvider>();

  typed.get(
    '/api/v1/channels',
    {
      schema: {
        tags: ['Channels'],
        summary: 'List tenant channels',
        querystring: listChannelsQuerySchema,
        response: {
          200: channelListSuccessResponseSchema,
        },
      },
    },
    async (request) => {
      const actor = requireActorContext();
      const { channels } = await deps.listChannels.execute({
        tenantId: actor.tenantId,
        actorPermissions: actor.permissions,
        ...(request.query.status === undefined ? {} : { status: request.query.status }),
        ...(request.query.marketplaceId === undefined
          ? {}
          : { marketplaceId: request.query.marketplaceId }),
      });

      return {
        success: true as const,
        data: channels.map(toChannelResponse),
      };
    },
  );

  typed.post(
    '/api/v1/channels',
    {
      schema: {
        tags: ['Channels'],
        summary: 'Create a tenant channel',
        body: createChannelBodySchema,
        response: {
          201: channelSuccessResponseSchema,
        },
      },
    },
    async (request, reply) => {
      const actor = requireActorContext();
      const { channel } = await deps.createChannel.execute({
        tenantId: actor.tenantId,
        actorPermissions: actor.permissions,
        marketplaceId: request.body.marketplaceId,
        name: request.body.name,
        ...(request.body.externalReference === undefined
          ? {}
          : { externalReference: request.body.externalReference }),
        ...(request.body.configurationReference === undefined
          ? {}
          : { configurationReference: request.body.configurationReference }),
      });

      void reply.status(201);
      return {
        success: true as const,
        data: toChannelResponse(channel),
      };
    },
  );

  typed.get(
    '/api/v1/channels/:channelId',
    {
      schema: {
        tags: ['Channels'],
        summary: 'Get a channel by id',
        params: channelIdParamsSchema,
        response: {
          200: channelSuccessResponseSchema,
        },
      },
    },
    async (request) => {
      const actor = requireActorContext();
      const { channel } = await deps.getChannel.execute({
        tenantId: actor.tenantId,
        actorPermissions: actor.permissions,
        channelId: request.params.channelId,
      });

      return {
        success: true as const,
        data: toChannelResponse(channel),
      };
    },
  );

  typed.patch(
    '/api/v1/channels/:channelId',
    {
      schema: {
        tags: ['Channels'],
        summary: 'Update a channel',
        params: channelIdParamsSchema,
        body: updateChannelBodySchema,
        response: {
          200: channelSuccessResponseSchema,
        },
      },
    },
    async (request) => {
      const actor = requireActorContext();
      const actorId = actor.userId ?? actor.tenantId;

      let channel;

      if (
        request.body.name !== undefined ||
        request.body.externalReference !== undefined ||
        request.body.configurationReference !== undefined
      ) {
        ({ channel } = await deps.updateChannel.execute({
          tenantId: actor.tenantId,
          actorPermissions: actor.permissions,
          channelId: request.params.channelId,
          ...(request.body.name === undefined ? {} : { name: request.body.name }),
          ...(request.body.externalReference === undefined
            ? {}
            : { externalReference: request.body.externalReference }),
          ...(request.body.configurationReference === undefined
            ? {}
            : { configurationReference: request.body.configurationReference }),
        }));
      } else {
        ({ channel } = await deps.getChannel.execute({
          tenantId: actor.tenantId,
          actorPermissions: actor.permissions,
          channelId: request.params.channelId,
        }));
      }

      if (request.body.status !== undefined && request.body.status !== channel.status) {
        if (request.body.status === ChannelStatus.ACTIVE) {
          ({ channel } = await deps.activateChannel.execute({
            tenantId: actor.tenantId,
            actorPermissions: actor.permissions,
            actorId,
            channelId: request.params.channelId,
          }));
        } else if (request.body.status === ChannelStatus.INACTIVE) {
          ({ channel } = await deps.deactivateChannel.execute({
            tenantId: actor.tenantId,
            actorPermissions: actor.permissions,
            actorId,
            channelId: request.params.channelId,
          }));
        } else {
          ({ channel } = await deps.suspendChannel.execute({
            tenantId: actor.tenantId,
            actorPermissions: actor.permissions,
            actorId,
            channelId: request.params.channelId,
          }));
        }
      }

      return {
        success: true as const,
        data: toChannelResponse(channel),
      };
    },
  );

  await Promise.resolve();
};

export default channelRoutes;
