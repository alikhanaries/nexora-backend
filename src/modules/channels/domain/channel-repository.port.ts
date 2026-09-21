import type { Queryable, Transaction } from '../../../shared/persistence/index.js';
import type { ChannelStatus } from './channel-status.js';
import type { Channel } from './channel.js';

export interface ChannelListFilters {
  readonly status?: ChannelStatus;
  readonly marketplaceId?: string;
}

export interface ChannelRepository {
  findById(queryable: Queryable, tenantId: string, channelId: string): Promise<Channel | null>;
  list(
    queryable: Queryable,
    tenantId: string,
    filters: ChannelListFilters,
  ): Promise<readonly Channel[]>;
  insert(transaction: Transaction, channel: Channel): Promise<void>;
  update(transaction: Transaction, channel: Channel): Promise<void>;
}
