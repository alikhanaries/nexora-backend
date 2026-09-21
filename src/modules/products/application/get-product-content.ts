import type { AuthorizationService } from '../../authorization/public/index.js';
import { NotFoundError } from '../../../shared/errors/index.js';
import type { Queryable, TransactionManager } from '../../../shared/persistence/index.js';
import type { ProductContentRepository } from '../domain/ports/product-content-repository.js';
import type { ProductRepository } from '../domain/ports/product-repository.js';
import { toProductContentDto, type ProductContentDto } from './product-dto.js';

export interface GetProductContentInput {
  readonly tenantId: string;
  readonly actorPermissions: readonly string[];
  readonly productId: string;
  readonly locale?: string | undefined;
}

export interface GetProductContentResult {
  readonly content: readonly ProductContentDto[];
}

export interface GetProductContentDeps {
  readonly authorization: AuthorizationService;
  readonly database: TransactionManager & Queryable;
  readonly products: ProductRepository;
  readonly productContent: ProductContentRepository;
}

export class GetProductContent {
  constructor(private readonly deps: GetProductContentDeps) {}

  async execute(input: GetProductContentInput): Promise<GetProductContentResult> {
    this.deps.authorization.requirePermission(input.actorPermissions, 'products.read');

    const product = await this.deps.products.findById(
      this.deps.database,
      input.tenantId,
      input.productId,
    );
    if (product === null) {
      throw new NotFoundError('Product was not found');
    }

    if (input.locale !== undefined) {
      const entry = await this.deps.productContent.findByProductAndLocale(
        this.deps.database,
        input.tenantId,
        input.productId,
        input.locale,
      );
      if (entry === null) {
        throw new NotFoundError('Product content was not found');
      }
      return { content: [toProductContentDto(entry)] };
    }

    const entries = await this.deps.productContent.listByProduct(
      this.deps.database,
      input.tenantId,
      input.productId,
    );

    return { content: entries.map(toProductContentDto) };
  }
}
