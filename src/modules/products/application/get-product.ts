import type { AuthorizationService } from '../../authorization/public/index.js';
import { NotFoundError } from '../../../shared/errors/index.js';
import type { Queryable, TransactionManager } from '../../../shared/persistence/index.js';
import type { ProductRepository } from '../domain/ports/product-repository.js';
import { toProductDto, type ProductDto } from './product-dto.js';

export interface GetProductInput {
  readonly tenantId: string;
  readonly actorPermissions: readonly string[];
  readonly productId: string;
}

export interface GetProductResult {
  readonly product: ProductDto;
}

export interface GetProductDeps {
  readonly authorization: AuthorizationService;
  readonly database: TransactionManager & Queryable;
  readonly products: ProductRepository;
}

export class GetProduct {
  constructor(private readonly deps: GetProductDeps) {}

  async execute(input: GetProductInput): Promise<GetProductResult> {
    this.deps.authorization.requirePermission(input.actorPermissions, 'products.read');

    const product = await this.deps.products.findById(
      this.deps.database,
      input.tenantId,
      input.productId,
    );
    if (product === null) {
      throw new NotFoundError('Product was not found');
    }

    return { product: toProductDto(product) };
  }
}
