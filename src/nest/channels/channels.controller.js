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
  createChannelBodySchema,
  listChannelsQuerySchema,
  updateChannelBodySchema,
} from '../../modules/channels/presentation/channel.schemas.js';
import {
  marketplaceConnectionBodySchema,
  marketplaceConnectionPatchBodySchema,
} from '../../modules/channels/presentation/marketplace-connection.schemas.js';
import { parseOrThrow } from '../../shared/validation/index.js';
import { ChannelsService } from './channels.service.js';

export @Controller()
class ChannelsController {
  constructor(@Inject(ChannelsService) channelsService) {
    this.channelsService = channelsService;
  }

  @Get('/api/v1/channels')
  async list(@Query() query) {
    const parsed = listChannelsQuerySchema.parse(query);
    const data = await this.channelsService.listChannels(parsed);
    return { success: true, data };
  }

  @Post('/api/v1/channels')
  @HttpCode(201)
  async create(@Body() body) {
    const parsed = parseOrThrow(createChannelBodySchema, body, 'create channel');
    const data = await this.channelsService.createChannel(parsed);
    return { success: true, data };
  }

  @Get('/api/v1/channels/:channelId')
  async getById(@Param() params) {
    const { channelId } = parseOrThrow(channelIdParamsSchema, params, 'channel params');
    const data = await this.channelsService.getChannel(channelId);
    return { success: true, data };
  }

  @Patch('/api/v1/channels/:channelId')
  @HttpCode(200)
  async patch(@Param() params, @Body() body) {
    const { channelId } = parseOrThrow(channelIdParamsSchema, params, 'channel params');
    const parsed = parseOrThrow(updateChannelBodySchema, body, 'update channel');
    const data = await this.channelsService.patchChannel(channelId, parsed);
    return { success: true, data };
  }

  @Post('/api/v1/channels/:channelId/marketplace-connection')
  @HttpCode(201)
  async upsertConnection(@Param() params, @Body() body) {
    const { channelId } = parseOrThrow(channelIdParamsSchema, params, 'channel params');
    const parsed = parseOrThrow(marketplaceConnectionBodySchema, body, 'marketplace connection');
    const data = await this.channelsService.upsertMarketplaceConnection(channelId, parsed);
    return { success: true, data };
  }

  @Get('/api/v1/channels/:channelId/marketplace-connection')
  async getConnection(@Param() params) {
    const { channelId } = parseOrThrow(channelIdParamsSchema, params, 'channel params');
    const data = await this.channelsService.getMarketplaceConnection(channelId);
    return { success: true, data };
  }

  @Patch('/api/v1/channels/:channelId/marketplace-connection')
  @HttpCode(200)
  async patchConnection(@Param() params, @Body() body) {
    const { channelId } = parseOrThrow(channelIdParamsSchema, params, 'channel params');
    const parsed = parseOrThrow(marketplaceConnectionPatchBodySchema, body, 'patch marketplace connection');
    const data = await this.channelsService.patchMarketplaceConnection(channelId, parsed);
    return { success: true, data };
  }

  @Delete('/api/v1/channels/:channelId/marketplace-connection')
  @HttpCode(200)
  async deleteConnection(@Param() params) {
    const { channelId } = parseOrThrow(channelIdParamsSchema, params, 'channel params');
    await this.channelsService.deleteMarketplaceConnection(channelId);
    return { success: true };
  }

  @Post('/api/v1/channels/:channelId/marketplace-connection/test')
  @HttpCode(200)
  async testConnection(@Param() params) {
    const { channelId } = parseOrThrow(channelIdParamsSchema, params, 'channel params');
    await this.channelsService.testMarketplaceConnection(channelId);
    return { success: true };
  }
}
