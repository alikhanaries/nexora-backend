import { auditRequestFields } from '../../audit/public/index.js';
import { NotFoundError } from '../../../shared/errors/index.js';
import { deactivateProductEntity } from '../models/product.js';
import { toProductDto } from './product-dto.js';
import { productStatusChangedEvent } from './product-events.js';

/**
 * @param {object} deps
 * @returns {{ execute: Function }}
 */
export function createDeactivateProduct(deps) {
/** Application workflow entry for this command/query (tenant-scoped, permission-checked). */
    async function execute(input) {
        deps.authorization.requirePermission(input.actorPermissions, 'products.update');
        const now = new Date();
        const product = await deps.database.execute(async (tx) => {
            const existing = await deps.products.findById(tx, input.tenantId, input.productId);
            if (existing === null) {
                throw new NotFoundError('Product was not found');
            }
            const previousStatus = existing.status;
            const updated = deactivateProductEntity(existing, now);
            await deps.products.update(tx, updated);
            const dto = toProductDto(updated);
            await deps.eventRecorder?.record(tx, productStatusChangedEvent(dto, previousStatus));
            await deps.auditRecorder?.record(tx, {
                tenantId: input.tenantId,
                actorKind: input.actorKind,
                actorId: input.actorId,
                eventType: 'PRODUCT_STATUS_CHANGED',
                resourceType: 'product',
                resourceId: updated.id,
                metadata: { previousStatus, status: updated.status },
                ...auditRequestFields(),
            });
            return dto;
        }, { tenantId: input.tenantId });
        return { product };
    }
    return { execute };
}
