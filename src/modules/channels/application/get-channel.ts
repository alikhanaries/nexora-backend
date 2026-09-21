import type { AuthorizationService } from '../../authorization/public/index.js';
import { NotFoundError } from '../../../shared/errors/index.js';
import type { TransactionManager } from '../../../shared/persistence/index.js';
import type { Channel } from '../domain/channel.js';
import type { ChannelRepository } from '../domain/channel-repository.port.js';
import { requireChannelRead } from './channel-permissions.js';

export interface GetChannelInput {
  readonly tenantId: string;
  readonly actorPermissions: readonly string[];
  readonly channelId: string;
}

export interface GetChannelResult {
  readonly channel: Channel;
}

export interface GetChannelDependencies {
  readonly authorization: AuthorizationService;
  readonly repository: ChannelRepository;
  readonly database: TransactionManager;
}

export class GetChannel {
  constructor(private readonly deps: GetChannelDependencies) {}

  async execute(input: GetChannelInput): Promise<GetChannelResult> {
    requireChannelRead(this.deps.authorization, input.actorPermissions);

    const channel = await this.deps.database.execute(
      async (tx) => {
        const existing = await this.deps.repository.findById(tx, input.tenantId, input.channelId);
        if (existing === null) {
          throw new NotFoundError('Channel was not found', {
            tenantId: input.tenantId,
            channelId: input.channelId,
          });
        }
        return existing;
      },
      { tenantId: input.tenantId },
    );

    return { channel };
  }
}
