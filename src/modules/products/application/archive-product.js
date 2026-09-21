import { auditRequestFields } from '../../audit/public/index.js';
import { NotFoundError } from '../../../shared/errors/index.js';
import { toProductDto } from './product-dto.js';
import { productStatusChangedEvent } from './product-events.js';
export class ArchiveProduct {
    deps;
    constructor(deps) {
        this.deps = deps;
    }
    async execute(input) {
        this.deps.authorization.requirePermission(input.actorPermissions, 'products.update');
        const now = new Date();
        const product = await this.deps.database.execute(async (tx) => {
            const existing = await this.deps.products.findById(tx, input.tenantId, input.productId);
            if (existing === null) {
                throw new NotFoundError('Product was not found');
            }
            const previousStatus = existing.status;
            const updated = existing.archive(now);
            await this.deps.products.update(tx, updated);
            const dto = toProductDto(updated);
            await this.deps.eventRecorder?.record(tx, productStatusChangedEvent(dto, previousStatus));
            await this.deps.auditRecorder?.record(tx, {
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
}
