import type { AuditRecorder } from '../../audit/public/index.js';
import { auditRequestFields } from '../../audit/public/index.js';
import type { AuthorizationService } from '../../authorization/public/index.js';
import type { EventRecorder } from '../../../shared/events/index.js';
import { NotFoundError } from '../../../shared/errors/index.js';
import type { TransactionManager } from '../../../shared/persistence/index.js';
import type { ProductType } from '../domain/product-type.js';
import type { ProductRepository } from '../domain/ports/product-repository.js';
import { toProductDto, type ProductDto } from './product-dto.js';
import { productUpdatedEvent } from './product-events.js';

export interface UpdateProductInput {
  readonly tenantId: string;
  readonly actorId: string;
  readonly actorKind: 'user' | 'api-key';
  readonly actorPermissions: readonly string[];
  readonly productId: string;
  readonly externalReference?: string | null | undefined;
  readonly productType?: ProductType | undefined;
}

export interface UpdateProductResult {
  readonly product: ProductDto;
}

export interface UpdateProductDeps {
  readonly authorization: AuthorizationService;
  readonly database: TransactionManager;
  readonly products: ProductRepository;
  readonly auditRecorder?: AuditRecorder;
  readonly eventRecorder?: EventRecorder;
}

export class UpdateProduct {
  constructor(private readonly deps: UpdateProductDeps) {}

  async execute(input: UpdateProductInput): Promise<UpdateProductResult> {
    this.deps.authorization.requirePermission(input.actorPermissions, 'products.update');

    const now = new Date();
    const externalReference =
      input.externalReference === undefined
        ? undefined
        : input.externalReference === null
          ? null
          : input.externalReference.trim() || null;

    const product = await this.deps.database.execute(
      async (tx) => {
        const existing = await this.deps.products.findById(tx, input.tenantId, input.productId);
        if (existing === null) {
          throw new NotFoundError('Product was not found');
        }

        const updated = existing.update(
          {
            ...(externalReference === undefined ? {} : { externalReference }),
            ...(input.productType === undefined ? {} : { productType: input.productType }),
          },
          now,
        );

        await this.deps.products.update(tx, updated);

        const dto = toProductDto(updated);
        const changes: Record<string, unknown> = {};
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
      },
      { tenantId: input.tenantId },
    );

    return { product };
  }
}
