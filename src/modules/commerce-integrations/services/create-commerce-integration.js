import { randomUUID } from 'node:crypto';
import { NotFoundError, ValidationError } from '../../../shared/errors/index.js';
import { createCommerceIntegrationEntity } from '../models/commerce-integration.js';
import { channelCreatedEvent } from './commerce-integration-events.js';
import { requireChannelCreate } from './commerce-integration-permissions.js';

export function createCreateCommerceIntegration(deps) {
    async function execute(input) {
        requireChannelCreate(deps.authorization, input.actorPermissions);
        const name = input.name.trim();
        if (name.length === 0) {
            throw new ValidationError('Channel name is required');
        }
        const { exists } = await deps.verifyMarketplaceExists.execute({
            marketplaceId: input.marketplaceId,
        });
        if (!exists) {
            throw new NotFoundError('Marketplace was not found', { marketplaceId: input.marketplaceId });
        }
        const now = new Date();
        const channel = createCommerceIntegrationEntity({
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
        await deps.database.execute(async (tx) => {
            if (channel.defaultStockLocationId !== null) {
                await deps.inventoryService.verifyUsableStockLocation(
                    input.tenantId,
                    channel.defaultStockLocationId,
                    tx,
                );
            }
            await deps.repository.insert(tx, channel);
            await deps.eventRecorder.record(tx, channelCreatedEvent(channel));
        }, { tenantId: input.tenantId });
        return { channel };
    }
    return { execute };
}
