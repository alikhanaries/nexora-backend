import { randomUUID } from 'node:crypto';
import { NotFoundError, ValidationError } from '../../../shared/errors/index.js';
import { CommerceIntegration } from '../domain/commerce-integration.js';
import { channelCreatedEvent } from './commerce-integration-events.js';
import { requireChannelCreate } from './commerce-integration-permissions.js';
export class CreateCommerceIntegration {
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
        const channel = CommerceIntegration.create({
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
            ...(input.defaultStockLocationId === undefined
                ? {}
                : { defaultStockLocationId: input.defaultStockLocationId }),
            createdAt: now,
        });
        await this.deps.database.execute(async (tx) => {
            if (channel.defaultStockLocationId !== null) {
                await this.deps.inventoryService.verifyUsableStockLocation(
                    input.tenantId,
                    channel.defaultStockLocationId,
                    tx,
                );
            }
            await this.deps.repository.insert(tx, channel);
            await this.deps.eventRecorder.record(tx, channelCreatedEvent(channel));
        }, { tenantId: input.tenantId });
        return { channel };
    }
}
