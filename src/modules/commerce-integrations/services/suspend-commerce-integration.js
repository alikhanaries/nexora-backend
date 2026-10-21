import { auditRequestFields } from '../../audit/public/index.js';
import { NotFoundError } from '../../../shared/errors/index.js';
import { suspendCommerceIntegration } from '../models/commerce-integration.js';
import { channelStatusChangedEvent } from './commerce-integration-events.js';
import { requireChannelUpdate } from './commerce-integration-permissions.js';

export function createSuspendCommerceIntegration(deps) {
    async function execute(input) {
        requireChannelUpdate(deps.authorization, input.actorPermissions);
        const channel = await deps.database.execute(async (tx) => {
            const existing = await deps.repository.findById(tx, input.tenantId, input.channelId);
            if (existing === null) {
                throw new NotFoundError('Channel was not found', {
                    tenantId: input.tenantId,
                    channelId: input.channelId,
                });
            }
            const previousStatus = existing.status;
            const updated = suspendCommerceIntegration(existing, new Date());
            await deps.repository.update(tx, updated);
            if (previousStatus !== updated.status) {
                await deps.eventRecorder.record(tx, channelStatusChangedEvent(updated, previousStatus));
                await deps.auditRecorder?.record(tx, {
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
    return { execute };
}
