import type { AuthorizationService } from '../../authorization/public/index.js';
import { NotFoundError, ValidationError } from '../../../shared/errors/index.js';
import type { EventRecorder } from '../../../shared/events/index.js';
import type { TransactionManager } from '../../../shared/persistence/index.js';
import type { Channel } from '../domain/channel.js';
import type { ChannelRepository } from '../domain/channel-repository.port.js';
import { channelUpdatedEvent } from './channel-events.js';
import { requireChannelUpdate } from './channel-permissions.js';

export interface UpdateChannelInput {
  readonly tenantId: string;
  readonly actorPermissions: readonly string[];
  readonly channelId: string;
  readonly name?: string;
  readonly externalReference?: string | null;
  readonly configurationReference?: string | null;
}

export interface UpdateChannelResult {
  readonly channel: Channel;
}

export interface UpdateChannelDependencies {
  readonly authorization: AuthorizationService;
  readonly repository: ChannelRepository;
  readonly database: TransactionManager;
  readonly eventRecorder: EventRecorder;
}

export class UpdateChannel {
  constructor(private readonly deps: UpdateChannelDependencies) {}

  async execute(input: UpdateChannelInput): Promise<UpdateChannelResult> {
    requireChannelUpdate(this.deps.authorization, input.actorPermissions);

    if (
      input.name === undefined &&
      input.externalReference === undefined &&
      input.configurationReference === undefined
    ) {
      throw new ValidationError('At least one field must be provided');
    }

    if (input.name !== undefined && input.name.trim().length === 0) {
      throw new ValidationError('Channel name is required');
    }

    const channel = await this.deps.database.execute(
      async (tx) => {
        const existing = await this.deps.repository.findById(tx, input.tenantId, input.channelId);
        if (existing === null) {
          throw new NotFoundError('Channel was not found', {
            tenantId: input.tenantId,
            channelId: input.channelId,
          });
        }

        const updated = existing.updateDetails(
          {
            ...(input.name === undefined ? {} : { name: input.name.trim() }),
            ...(input.externalReference === undefined
              ? {}
              : { externalReference: input.externalReference }),
            ...(input.configurationReference === undefined
              ? {}
              : { configurationReference: input.configurationReference }),
          },
          new Date(),
        );

        if (
          updated.name === existing.name &&
          updated.externalReference === existing.externalReference &&
          updated.configurationReference === existing.configurationReference
        ) {
          return existing;
        }

        await this.deps.repository.update(tx, updated);
        await this.deps.eventRecorder.record(tx, channelUpdatedEvent(updated));
        return updated;
      },
      { tenantId: input.tenantId },
    );

    return { channel };
  }
}
