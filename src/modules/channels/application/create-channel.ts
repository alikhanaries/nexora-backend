import { randomUUID } from 'node:crypto';
import type { AuthorizationService } from '../../authorization/public/index.js';
import type { VerifyMarketplaceExists } from '../../marketplaces/public/index.js';
import { NotFoundError, ValidationError } from '../../../shared/errors/index.js';
import type { EventRecorder } from '../../../shared/events/index.js';
import type { TransactionManager } from '../../../shared/persistence/index.js';
import { Channel } from '../domain/channel.js';
import type { ChannelRepository } from '../domain/channel-repository.port.js';
import { channelCreatedEvent } from './channel-events.js';
import { requireChannelCreate } from './channel-permissions.js';

export interface CreateChannelInput {
  readonly tenantId: string;
  readonly actorPermissions: readonly string[];
  readonly marketplaceId: string;
  readonly name: string;
  readonly externalReference?: string | null;
  readonly configurationReference?: string | null;
}

export interface CreateChannelResult {
  readonly channel: Channel;
}

export interface CreateChannelDependencies {
  readonly authorization: AuthorizationService;
  readonly repository: ChannelRepository;
  readonly database: TransactionManager;
  readonly eventRecorder: EventRecorder;
  readonly verifyMarketplaceExists: VerifyMarketplaceExists;
}

export class CreateChannel {
  constructor(private readonly deps: CreateChannelDependencies) {}

  async execute(input: CreateChannelInput): Promise<CreateChannelResult> {
    requireChannelCreate(this.deps.authorization, input.actorPermissions);

    const name = input.name.trim();
    if (name.length === 0) {
      throw new ValidationError('Channel name is required');
    }

    const { exists } = await this.deps.verifyMarketplaceExists.execute({
      marketplaceId: input.marketplaceId,
    });
    if (!exists) {
      throw new NotFoundError('Marketplace was not found', { marketplaceId: input.marketplaceId });
    }

    const now = new Date();
    const channel = Channel.create({
      id: randomUUID(),
      tenantId: input.tenantId,
      marketplaceId: input.marketplaceId,
      name,
      ...(input.externalReference === undefined
        ? {}
        : { externalReference: input.externalReference }),
      ...(input.configurationReference === undefined
        ? {}
        : { configurationReference: input.configurationReference }),
      createdAt: now,
    });

    await this.deps.database.execute(
      async (tx) => {
        await this.deps.repository.insert(tx, channel);
        await this.deps.eventRecorder.record(tx, channelCreatedEvent(channel));
      },
      { tenantId: input.tenantId },
    );

    return { channel };
  }
}
