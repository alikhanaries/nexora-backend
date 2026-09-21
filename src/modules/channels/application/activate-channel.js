import { auditRequestFields } from '../../audit/public/index.js';
import { NotFoundError } from '../../../shared/errors/index.js';
import { channelStatusChangedEvent } from './channel-events.js';
import { requireChannelUpdate } from './channel-permissions.js';
export class ActivateChannel {
    deps;
    constructor(deps) {
        this.deps = deps;
    }
    async execute(input) {
        requireChannelUpdate(this.deps.authorization, input.actorPermissions);
        const channel = await this.deps.database.execute(async (tx) => {
            const existing = await this.deps.repository.findById(tx, input.tenantId, input.channelId);
            if (existing === null) {
                throw new NotFoundError('Channel was not found', {
                    tenantId: input.tenantId,
                    channelId: input.channelId,
                });
            }
            const previousStatus = existing.status;
            const updated = existing.activate(new Date());
            await this.deps.repository.update(tx, updated);
            if (previousStatus !== updated.status) {
                await this.deps.eventRecorder.record(tx, channelStatusChangedEvent(updated, previousStatus));
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
        }, { tenantId: input.tenantId });
        return { channel };
    }
}
