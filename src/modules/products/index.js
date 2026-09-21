import { ArchiveProduct, CreateProduct, DeactivateProduct, DefaultProductQueryService, GetProduct, GetProductContent, ListProducts, UpdateProduct, UpsertProductContent, } from './application/index.js';
import { PostgresProductContentRepository, PostgresProductRepository, } from './infrastructure/index.js';
import productRoutes, {} from './presentation/product.routes.js';
export function createProductsModule(deps) {
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
    const useCases = {
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
export { Product, ProductContent, ProductStatus, ProductType, normalizeMerchantSku, } from './domain/index.js';
