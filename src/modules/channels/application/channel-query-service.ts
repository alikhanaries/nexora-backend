import { BusinessRuleError, NotFoundError } from '../../../shared/errors/index.js';
import type { Queryable, Transaction } from '../../../shared/persistence/index.js';
import type { Channel } from '../domain/channel.js';
import type { ChannelListFilters } from '../domain/channel-repository.port.js';

export interface ChannelQueryService {
  getChannelById(tenantId: string, channelId: string, tx?: Transaction): Promise<Channel>;
  listChannels(
    tenantId: string,
    filters: ChannelListFilters,
    tx?: Transaction,
  ): Promise<readonly Channel[]>;
  verifyChannelBelongsToTenant(
    tenantId: string,
    channelId: string,
    tx?: Transaction,
  ): Promise<Channel>;
  verifyChannelUsable(tenantId: string, channelId: string, tx?: Transaction): Promise<Channel>;
}

export interface ChannelQueryServiceDependencies {
  readonly queryable: Queryable;
  readonly getChannelById: (
    tenantId: string,
    channelId: string,
    queryable: Queryable,
  ) => Promise<Channel | null>;
  readonly listChannels: (
    tenantId: string,
    filters: ChannelListFilters,
    queryable: Queryable,
  ) => Promise<readonly Channel[]>;
}

export class DefaultChannelQueryService implements ChannelQueryService {
  constructor(private readonly deps: ChannelQueryServiceDependencies) {}

  async getChannelById(tenantId: string, channelId: string, tx?: Transaction): Promise<Channel> {
    const queryable = tx ?? this.deps.queryable;
    const channel = await this.deps.getChannelById(tenantId, channelId, queryable);
    if (channel === null) {
      throw new NotFoundError('Channel was not found', { tenantId, channelId });
    }
    return channel;
  }

  async listChannels(
    tenantId: string,
    filters: ChannelListFilters,
    tx?: Transaction,
  ): Promise<readonly Channel[]> {
    const queryable = tx ?? this.deps.queryable;
    return this.deps.listChannels(tenantId, filters, queryable);
  }

  async verifyChannelBelongsToTenant(
    tenantId: string,
    channelId: string,
    tx?: Transaction,
  ): Promise<Channel> {
    return this.getChannelById(tenantId, channelId, tx);
  }

  async verifyChannelUsable(
    tenantId: string,
    channelId: string,
    tx?: Transaction,
  ): Promise<Channel> {
    const channel = await this.getChannelById(tenantId, channelId, tx);
    if (!channel.isUsable()) {
      throw new BusinessRuleError('Channel is not usable', {
        tenantId,
        channelId,
        status: channel.status,
      });
    }
    return channel;
  }
}
