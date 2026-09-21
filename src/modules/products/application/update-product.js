import { auditRequestFields } from '../../audit/public/index.js';
import { NotFoundError } from '../../../shared/errors/index.js';
import { toProductDto } from './product-dto.js';
import { productUpdatedEvent } from './product-events.js';
export class UpdateProduct {
    deps;
    constructor(deps) {
        this.deps = deps;
    }
    async execute(input) {
        this.deps.authorization.requirePermission(input.actorPermissions, 'products.update');
        const now = new Date();
        const externalReference = input.externalReference === undefined
            ? undefined
            : input.externalReference === null
                ? null
                : input.externalReference.trim() || null;
        const product = await this.deps.database.execute(async (tx) => {
            const existing = await this.deps.products.findById(tx, input.tenantId, input.productId);
            if (existing === null) {
                throw new NotFoundError('Product was not found');
            }
            const updated = existing.update({
                ...(externalReference === undefined ? {} : { externalReference }),
                ...(input.productType === undefined ? {} : { productType: input.productType }),
            }, now);
            await this.deps.products.update(tx, updated);
            const dto = toProductDto(updated);
            const changes = {};
            if (externalReference !== undefined && externalReference !== existing.externalReference) {
                changes['externalReference'] = {
                    from: existing.externalReference,
                    to: externalReference,
                };
            }
            if (input.productType !== undefined && input.productType !== existing.productType) {
                changes['productType'] = { from: existing.productType, to: input.productType };
            }
            if (Object.keys(changes).length > 0) {
                await this.deps.eventRecorder?.record(tx, productUpdatedEvent(dto, changes));
                await this.deps.auditRecorder?.record(tx, {
                    tenantId: input.tenantId,
                    actorKind: input.actorKind,
                    actorId: input.actorId,
                    eventType: 'PRODUCT_UPDATED',
                    resourceType: 'product',
                    resourceId: updated.id,
                    metadata: { changes },
                    ...auditRequestFields(),
                });
            }
            return dto;
        }, { tenantId: input.tenantId });
        return { product };
    }
}
