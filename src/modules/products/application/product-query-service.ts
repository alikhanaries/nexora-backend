import type { Transaction } from '../../../shared/persistence/index.js';
import type { ProductDto } from './product-dto.js';

export interface ProductQueryService {
  getProductById(tenantId: string, productId: string, tx?: Transaction): Promise<ProductDto | null>;
  getProductBySku(
    tenantId: string,
    merchantSku: string,
    tx?: Transaction,
  ): Promise<ProductDto | null>;
  getProductsByIds(
    tenantId: string,
    productIds: readonly string[],
    tx?: Transaction,
  ): Promise<readonly ProductDto[]>;
  verifyProductBelongsToTenant(
    tenantId: string,
    productId: string,
    tx?: Transaction,
  ): Promise<boolean>;
}

export type { ProductDto } from './product-dto.js';
