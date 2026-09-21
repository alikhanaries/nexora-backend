import type { AuthorizationService } from '../../authorization/public/index.js';
import type { TransactionManager } from '../../../shared/persistence/index.js';
import type { Channel } from '../domain/channel.js';
import type { ChannelStatus } from '../domain/channel-status.js';
import type { ChannelRepository } from '../domain/channel-repository.port.js';
import { requireChannelRead } from './channel-permissions.js';

export interface ListChannelsInput {
  readonly tenantId: string;
  readonly actorPermissions: readonly string[];
  readonly status?: ChannelStatus;
  readonly marketplaceId?: string;
}

export interface ListChannelsResult {
  readonly channels: readonly Channel[];
}

export interface ListChannelsDependencies {
  readonly authorization: AuthorizationService;
  readonly repository: ChannelRepository;
  readonly database: TransactionManager;
}

export class ListChannels {
  constructor(private readonly deps: ListChannelsDependencies) {}

  async execute(input: ListChannelsInput): Promise<ListChannelsResult> {
    requireChannelRead(this.deps.authorization, input.actorPermissions);

    const channels = await this.deps.database.execute(
      async (tx) =>
        this.deps.repository.list(tx, input.tenantId, {
          ...(input.status === undefined ? {} : { status: input.status }),
          ...(input.marketplaceId === undefined ? {} : { marketplaceId: input.marketplaceId }),
        }),
      { tenantId: input.tenantId },
    );

    return { channels };
  }
}
