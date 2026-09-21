import type { AuditRecorder } from '../../audit/public/index.js';
import { auditRequestFields } from '../../audit/public/index.js';
import type { AuthorizationService } from '../../authorization/public/index.js';
import { NotFoundError } from '../../../shared/errors/index.js';
import type { EventRecorder } from '../../../shared/events/index.js';
import type { TransactionManager } from '../../../shared/persistence/index.js';
import type { Channel } from '../domain/channel.js';
import type { ChannelRepository } from '../domain/channel-repository.port.js';
import { channelStatusChangedEvent } from './channel-events.js';
import { requireChannelUpdate } from './channel-permissions.js';

export interface DeactivateChannelInput {
  readonly tenantId: string;
  readonly actorPermissions: readonly string[];
  readonly actorId: string;
  readonly channelId: string;
}

export interface DeactivateChannelResult {
  readonly channel: Channel;
}

export interface DeactivateChannelDependencies {
  readonly authorization: AuthorizationService;
  readonly repository: ChannelRepository;
  readonly database: TransactionManager;
  readonly eventRecorder: EventRecorder;
  readonly auditRecorder?: AuditRecorder;
}

export class DeactivateChannel {
  constructor(private readonly deps: DeactivateChannelDependencies) {}

  async execute(input: DeactivateChannelInput): Promise<DeactivateChannelResult> {
    requireChannelUpdate(this.deps.authorization, input.actorPermissions);

    const channel = await this.deps.database.execute(
      async (tx) => {
        const existing = await this.deps.repository.findById(tx, input.tenantId, input.channelId);
        if (existing === null) {
          throw new NotFoundError('Channel was not found', {
            tenantId: input.tenantId,
            channelId: input.channelId,
          });
        }

        const previousStatus = existing.status;
        const updated = existing.deactivate(new Date());
        await this.deps.repository.update(tx, updated);

        if (previousStatus !== updated.status) {
          await this.deps.eventRecorder.record(
            tx,
            channelStatusChangedEvent(updated, previousStatus),
          );
          await this.deps.auditRecorder?.record(tx, {
            tenantId: input.tenantId,
            actorKind: 'user',
            actorId: input.actorId,
            eventType: 'CHANNEL_STATUS_CHANGED',
            resourceType: 'channel',
            resourceId: updated.id,
            metadata: {
              previousStatus,
              newStatus: updated.status,
              marketplaceId: updated.marketplaceId,
            },
            ...auditRequestFields(),
          });
        }

        return updated;
      },
      { tenantId: input.tenantId },
    );

    return { channel };
  }
}
