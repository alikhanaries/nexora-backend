import type { AuthorizationService } from '../../authorization/public/index.js';
import { ValidationError } from '../../../shared/errors/index.js';
import {
  clampCursorLimit,
  decodeCursor,
  encodeCursor,
  type CursorPage,
} from '../../../shared/pagination/index.js';
import type { Queryable, TransactionManager } from '../../../shared/persistence/index.js';
import type { ProductRepository } from '../domain/ports/product-repository.js';
import type { ProductStatus } from '../domain/product-status.js';
import { toProductDto, type ProductDto } from './product-dto.js';

export interface ListProductsInput {
  readonly tenantId: string;
  readonly actorPermissions: readonly string[];
  readonly limit?: number | undefined;
  readonly cursor?: string | undefined;
  readonly status?: ProductStatus | undefined;
}

export interface ListProductsDeps {
  readonly authorization: AuthorizationService;
  readonly database: TransactionManager & Queryable;
  readonly products: ProductRepository;
}

export class ListProducts {
  constructor(private readonly deps: ListProductsDeps) {}

  async execute(input: ListProductsInput): Promise<CursorPage<ProductDto>> {
    this.deps.authorization.requirePermission(input.actorPermissions, 'products.read');

    const limit = clampCursorLimit(input.limit);
    const fetchLimit = limit + 1;

    let cursorCreatedAt: Date | null = null;
    let cursorId: string | null = null;
    if (input.cursor !== undefined) {
      const parts = decodeCursor(input.cursor);
      if (parts.length !== 2) {
        throw new ValidationError('Invalid cursor');
      }
      cursorCreatedAt = new Date(parts[0] ?? '');
      cursorId = parts[1] ?? null;
    }

    const page = await this.deps.products.listPage(
      this.deps.database,
      input.tenantId,
      { status: input.status },
      fetchLimit,
      cursorCreatedAt,
      cursorId,
    );

    const hasMore = page.items.length > limit;
    const items = hasMore ? page.items.slice(0, limit) : page.items;
    const last = items.at(-1);

    return {
      items: items.map(toProductDto),
      hasMore,
      nextCursor:
        hasMore && last !== undefined
          ? encodeCursor([last.createdAt.toISOString(), last.id])
          : null,
    };
  }
}
