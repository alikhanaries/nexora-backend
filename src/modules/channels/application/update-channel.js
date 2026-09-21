import { NotFoundError, ValidationError } from '../../../shared/errors/index.js';
import { channelUpdatedEvent } from './channel-events.js';
import { requireChannelUpdate } from './channel-permissions.js';
export class UpdateChannel {
    deps;
    constructor(deps) {
        this.deps = deps;
    }
    async execute(input) {
        requireChannelUpdate(this.deps.authorization, input.actorPermissions);
        if (input.name === undefined &&
            input.externalReference === undefined &&
            input.configurationReference === undefined) {
            throw new ValidationError('At least one field must be provided');
        }
        if (input.name !== undefined && input.name.trim().length === 0) {
            throw new ValidationError('Channel name is required');
        }
        const channel = await this.deps.database.execute(async (tx) => {
            const existing = await this.deps.repository.findById(tx, input.tenantId, input.channelId);
            if (existing === null) {
                throw new NotFoundError('Channel was not found', {
                    tenantId: input.tenantId,
                    channelId: input.channelId,
                });
            }
            const updated = existing.updateDetails({
                ...(input.name === undefined ? {} : { name: input.name.trim() }),
                ...(input.externalReference === undefined
                    ? {}
                    : { externalReference: input.externalReference }),
                ...(input.configurationReference === undefined
                    ? {}
                    : { configurationReference: input.configurationReference }),
            }, new Date());
            if (updated.name === existing.name &&
                updated.externalReference === existing.externalReference &&
                updated.configurationReference === existing.configurationReference) {
                return existing;
            }
            await this.deps.repository.update(tx, updated);
            await this.deps.eventRecorder.record(tx, channelUpdatedEvent(updated));
            return updated;
        }, { tenantId: input.tenantId });
        return { channel };
    }
}
