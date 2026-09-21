import { randomUUID } from 'node:crypto';
import { auditRequestFields } from '../../../audit/public/index.js';
import { ValidationError } from '../../../../shared/errors/index.js';
import { StockLocation } from '../../domain/stock-location.js';
export class CreateStockLocation {
    deps;
    constructor(deps) {
        this.deps = deps;
    }
    async execute(input) {
        this.deps.authorization.requirePermission(input.actorPermissions, 'inventory.adjust');
        const name = input.name.trim();
        if (name.length === 0) {
            throw new ValidationError('Stock location name is required');
        }
        const now = new Date();
        const location = StockLocation.create({
            id: randomUUID(),
            tenantId: input.tenantId,
            name,
            ...(input.externalReference === undefined
                ? {}
                : { externalReference: input.externalReference }),
            createdAt: now,
        });
        await this.deps.transactionManager.execute(async (tx) => {
            await this.deps.stockLocations.insert(tx, location);
            if (this.deps.auditRecorder !== undefined) {
                await this.deps.auditRecorder.record(tx, {
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
}
