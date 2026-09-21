import type { AuditRecorder } from '../audit/public/index.js';
import type { AuthorizationService } from '../authorization/public/index.js';
import type { EventRecorder } from '../../shared/events/index.js';
import type { Queryable, TransactionManager } from '../../shared/persistence/index.js';
import {
  ArchiveProduct,
  CreateProduct,
  DeactivateProduct,
  DefaultProductQueryService,
  GetProduct,
  GetProductContent,
  ListProducts,
  UpdateProduct,
  UpsertProductContent,
} from './application/index.js';
import {
  PostgresProductContentRepository,
  PostgresProductRepository,
} from './infrastructure/index.js';
import productRoutes, { type ProductRoutesDependencies } from './presentation/product.routes.js';

export interface ProductsModuleDependencies {
  readonly database: TransactionManager & Queryable;
  readonly authorization: AuthorizationService;
  readonly auditRecorder?: AuditRecorder;
  readonly eventRecorder?: EventRecorder;
}

export interface ProductsModule {
  readonly useCases: ProductRoutesDependencies;
  readonly productQueryService: DefaultProductQueryService;
  readonly routes: typeof productRoutes;
}

export function createProductsModule(deps: ProductsModuleDependencies): ProductsModule {
  const products = new PostgresProductRepository();
  const productContent = new PostgresProductContentRepository();

  const sharedDeps = {
    authorization: deps.authorization,
    database: deps.database,
    products,
    ...(deps.auditRecorder === undefined ? {} : { auditRecorder: deps.auditRecorder }),
    ...(deps.eventRecorder === undefined ? {} : { eventRecorder: deps.eventRecorder }),
  };

  const createProduct = new CreateProduct(sharedDeps);
  const getProduct = new GetProduct({ ...sharedDeps, database: deps.database });
  const listProducts = new ListProducts({ ...sharedDeps, database: deps.database });
  const updateProduct = new UpdateProduct(sharedDeps);
  const deactivateProduct = new DeactivateProduct(sharedDeps);
  const archiveProduct = new ArchiveProduct(sharedDeps);
  const upsertProductContent = new UpsertProductContent({
    ...sharedDeps,
    productContent,
  });
  const getProductContent = new GetProductContent({
    ...sharedDeps,
    database: deps.database,
    productContent,
  });

  const productQueryService = new DefaultProductQueryService({
    database: deps.database,
    products,
  });

  const useCases: ProductRoutesDependencies = {
    createProduct,
    getProduct,
    listProducts,
    updateProduct,
    deactivateProduct,
    archiveProduct,
    upsertProductContent,
    getProductContent,
  };

  return {
    useCases,
    productQueryService,
    routes: productRoutes,
  };
}

export {
  Product,
  ProductContent,
  ProductStatus,
  ProductType,
  normalizeMerchantSku,
} from './domain/index.js';
