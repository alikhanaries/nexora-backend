import { randomUUID } from 'node:crypto';
import type { AuditRecorder } from '../../audit/public/index.js';
import { auditRequestFields } from '../../audit/public/index.js';
import type { AuthorizationService } from '../../authorization/public/index.js';
import type { EventRecorder } from '../../../shared/events/index.js';
import { ConflictError } from '../../../shared/errors/index.js';
import type { TransactionManager } from '../../../shared/persistence/index.js';
import { Product } from '../domain/product.js';
import { ProductType } from '../domain/product-type.js';
import { normalizeMerchantSku, validateMerchantSku } from '../domain/merchant-sku.js';
import type { ProductRepository } from '../domain/ports/product-repository.js';
import { toProductDto, type ProductDto } from './product-dto.js';
import { productCreatedEvent } from './product-events.js';

export interface CreateProductInput {
  readonly tenantId: string;
  readonly actorId: string;
  readonly actorKind: 'user' | 'api-key';
  readonly actorPermissions: readonly string[];
  readonly merchantSku: string;
  readonly externalReference?: string | null | undefined;
  readonly productType?: ProductType | undefined;
}

export interface CreateProductResult {
  readonly product: ProductDto;
}

export interface CreateProductDeps {
  readonly authorization: AuthorizationService;
  readonly database: TransactionManager;
  readonly products: ProductRepository;
  readonly auditRecorder?: AuditRecorder;
  readonly eventRecorder?: EventRecorder;
}

export class CreateProduct {
  constructor(private readonly deps: CreateProductDeps) {}

  async execute(input: CreateProductInput): Promise<CreateProductResult> {
    this.deps.authorization.requirePermission(input.actorPermissions, 'products.create');

    const merchantSku = normalizeMerchantSku(input.merchantSku);
    validateMerchantSku(merchantSku);

    const externalReference =
      input.externalReference === undefined || input.externalReference === null
        ? null
        : input.externalReference.trim() || null;

    const now = new Date();
    const product = Product.create({
      id: randomUUID(),
      tenantId: input.tenantId,
      merchantSku,
      externalReference,
      productType: input.productType ?? ProductType.STANDARD,
      createdAt: now,
    });

    const saved = await this.deps.database.execute(
      async (tx) => {
        const existing = await this.deps.products.findBySku(tx, input.tenantId, merchantSku);
        if (existing !== null) {
          throw new ConflictError('A product with this merchant SKU already exists', {
            merchantSku,
          });
        }

        await this.deps.products.insert(tx, product);

        const dto = toProductDto(product);

        await this.deps.eventRecorder?.record(tx, productCreatedEvent(dto));

        await this.deps.auditRecorder?.record(tx, {
          tenantId: input.tenantId,
          actorKind: input.actorKind,
          actorId: input.actorId,
          eventType: 'PRODUCT_CREATED',
          resourceType: 'product',
          resourceId: product.id,
          metadata: {
            merchantSku: product.merchantSku,
            productType: product.productType,
          },
          ...auditRequestFields(),
        });

        return dto;
      },
      { tenantId: input.tenantId },
    );

    return { product: saved };
  }
}
