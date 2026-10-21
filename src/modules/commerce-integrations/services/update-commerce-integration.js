import { NotFoundError, ValidationError } from '../../../shared/errors/index.js';
import { updateCommerceIntegrationDetails } from '../models/commerce-integration.js';
import { channelUpdatedEvent } from './commerce-integration-events.js';
import { requireChannelUpdate } from './commerce-integration-permissions.js';

/** @param {object} deps @returns {{ execute: Function }} */
export function createUpdateCommerceIntegration(deps) {
    /** Patches name/refs/stock location; emits updated event when row changes. Authz: `channels.update`. */
    async function execute(input) {
        requireChannelUpdate(deps.authorization, input.actorPermissions);
        if (input.name === undefined &&
            input.externalReference === undefined &&
            input.configurationReference === undefined &&
            input.defaultStockLocationId === undefined) {
            throw new ValidationError('At least one field must be provided');
        }
        if (input.name !== undefined && input.name.trim().length === 0) {
            throw new ValidationError('Channel name is required');
        }
        const channel = await deps.database.execute(async (tx) => {
            const existing = await deps.repository.findById(tx, input.tenantId, input.channelId);
            if (existing === null) {
                throw new NotFoundError('Channel was not found', {
                    tenantId: input.tenantId,
                    channelId: input.channelId,
                });
            }
            const updated = updateCommerceIntegrationDetails(existing, {
                ...(input.name === undefined ? {} : { name: input.name.trim() }),
                ...(input.externalReference === undefined
                    ? {}
                    : { externalReference: input.externalReference }),
                ...(input.configurationReference === undefined
                    ? {}
                    : { configurationReference: input.configurationReference }),
                ...(input.defaultStockLocationId === undefined
                    ? {}
                    : { defaultStockLocationId: input.defaultStockLocationId }),
            }, new Date());
            if (updated.name === existing.name &&
                updated.externalReference === existing.externalReference &&
                updated.configurationReference === existing.configurationReference &&
                updated.defaultStockLocationId === existing.defaultStockLocationId) {
                return existing;
            }
            if (input.defaultStockLocationId !== undefined &&
                input.defaultStockLocationId !== null) {
                await deps.inventoryService.verifyUsableStockLocation(
                    input.tenantId,
                    input.defaultStockLocationId,
                    tx,
                );
            }
            await deps.repository.update(tx, updated);
            await deps.eventRecorder.record(tx, channelUpdatedEvent(updated));
            return updated;
        }, { tenantId: input.tenantId });
        return { channel };
    }
    return { execute };
}
