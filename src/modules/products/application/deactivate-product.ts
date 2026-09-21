import type { AuditRecorder } from '../../audit/public/index.js';
import { auditRequestFields } from '../../audit/public/index.js';
import type { AuthorizationService } from '../../authorization/public/index.js';
import type { EventRecorder } from '../../../shared/events/index.js';
import { NotFoundError } from '../../../shared/errors/index.js';
import type { TransactionManager } from '../../../shared/persistence/index.js';
import type { ProductRepository } from '../domain/ports/product-repository.js';
import { toProductDto, type ProductDto } from './product-dto.js';
import { productStatusChangedEvent } from './product-events.js';

export interface DeactivateProductInput {
  readonly tenantId: string;
  readonly actorId: string;
  readonly actorKind: 'user' | 'api-key';
  readonly actorPermissions: readonly string[];
  readonly productId: string;
}

export interface DeactivateProductResult {
  readonly product: ProductDto;
}

export interface DeactivateProductDeps {
  readonly authorization: AuthorizationService;
  readonly database: TransactionManager;
  readonly products: ProductRepository;
  readonly auditRecorder?: AuditRecorder;
  readonly eventRecorder?: EventRecorder;
}

export class DeactivateProduct {
  constructor(private readonly deps: DeactivateProductDeps) {}

  async execute(input: DeactivateProductInput): Promise<DeactivateProductResult> {
    this.deps.authorization.requirePermission(input.actorPermissions, 'products.update');

    const now = new Date();

    const product = await this.deps.database.execute(
      async (tx) => {
        const existing = await this.deps.products.findById(tx, input.tenantId, input.productId);
        if (existing === null) {
          throw new NotFoundError('Product was not found');
        }

        const previousStatus = existing.status;
        const updated = existing.deactivate(now);

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
      },
      { tenantId: input.tenantId },
    );

    return { product };
  }
}
