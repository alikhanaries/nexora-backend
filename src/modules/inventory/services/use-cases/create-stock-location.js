import { randomUUID } from 'node:crypto';
import { auditRequestFields } from '../../../audit/public/index.js';
import { ValidationError } from '../../../../shared/errors/index.js';
import { createStockLocationEntity } from '../../models/stock-location.js';

/**
 * @param {object} deps
 * @returns {{ execute: Function }}
 */
export function createCreateStockLocation(deps) {
/** HTTP use-case entry: enforces permissions, scopes to tenant, delegates to domain service. */
    async function execute(input) {
        deps.authorization.requirePermission(input.actorPermissions, 'inventory.adjust');
        const name = input.name.trim();
        if (name.length === 0) {
            throw new ValidationError('Stock location name is required');
        }
        const now = new Date();
        const location = createStockLocationEntity({
            id: randomUUID(),
            tenantId: input.tenantId,
            name,
            ...(input.externalReference === undefined
                ? {}
                : { externalReference: input.externalReference }),
            createdAt: now,
        });
        await deps.transactionManager.execute(async (tx) => {
            await deps.stockLocations.insert(tx, location);
            if (deps.auditRecorder !== undefined) {
                await deps.auditRecorder.record(tx, {
                    tenantId: input.tenantId,
                    actorKind: input.actorId === undefined ? 'system' : 'user',
                    ...(input.actorId === undefined ? {} : { actorId: input.actorId }),
                    eventType: 'STOCK_LOCATION_CREATED',
                    resourceType: 'stock_location',
                    resourceId: location.id,
                    metadata: {
                        name: location.name,
                        externalReference: location.externalReference,
                    },
                    ...auditRequestFields(),
                });
            }
        }, { tenantId: input.tenantId });
        return { location };
    }
    return { execute };
}
