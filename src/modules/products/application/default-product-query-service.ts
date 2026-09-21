import type {
  Queryable,
  Transaction,
  TransactionManager,
} from '../../../shared/persistence/index.js';
import type { ProductRepository } from '../domain/ports/product-repository.js';
import { toProductDto, type ProductDto } from './product-dto.js';
import type { ProductQueryService } from './product-query-service.js';

export interface DefaultProductQueryServiceDeps {
  readonly database: TransactionManager & Queryable;
  readonly products: ProductRepository;
}

export class DefaultProductQueryService implements ProductQueryService {
  constructor(private readonly deps: DefaultProductQueryServiceDeps) {}

  async getProductById(
    tenantId: string,
    productId: string,
    tx?: Transaction,
  ): Promise<ProductDto | null> {
    const queryable: Queryable = tx ?? this.deps.database;
    const product = await this.deps.products.findById(queryable, tenantId, productId);
    return product === null ? null : toProductDto(product);
  }

  async getProductBySku(
    tenantId: string,
    merchantSku: string,
    tx?: Transaction,
  ): Promise<ProductDto | null> {
    const queryable: Queryable = tx ?? this.deps.database;
    const product = await this.deps.products.findBySku(queryable, tenantId, merchantSku);
    return product === null ? null : toProductDto(product);
  }

  async getProductsByIds(
    tenantId: string,
    productIds: readonly string[],
    tx?: Transaction,
  ): Promise<readonly ProductDto[]> {
    if (productIds.length === 0) return [];

    const queryable = tx ?? this.deps.database;
    const products = await this.deps.products.findByIds(queryable, tenantId, productIds);
    return products.map(toProductDto);
  }

  async verifyProductBelongsToTenant(
    tenantId: string,
    productId: string,
    tx?: Transaction,
  ): Promise<boolean> {
    const queryable = tx ?? this.deps.database;
    const product = await this.deps.products.findById(queryable, tenantId, productId);
    return product !== null;
  }
}
