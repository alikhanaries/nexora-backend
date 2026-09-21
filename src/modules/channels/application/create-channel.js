import { randomUUID } from 'node:crypto';
import { NotFoundError, ValidationError } from '../../../shared/errors/index.js';
import { Channel } from '../domain/channel.js';
import { channelCreatedEvent } from './channel-events.js';
import { requireChannelCreate } from './channel-permissions.js';
export class CreateChannel {
    deps;
    constructor(deps) {
        this.deps = deps;
    }
    async execute(input) {
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
        await this.deps.database.execute(async (tx) => {
            await this.deps.repository.insert(tx, channel);
            await this.deps.eventRecorder.record(tx, channelCreatedEvent(channel));
        }, { tenantId: input.tenantId });
        return { channel };
    }
}
