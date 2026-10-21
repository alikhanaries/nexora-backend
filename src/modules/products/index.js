/**
 * Products and localized content: catalog CRUD, archive/deactivate, and product query service for other domains.
 * Re-exports product entity helpers from `./models`.
 */
import {
    createArchiveProduct,
    createCreateProduct,
    createDeactivateProduct,
    createDefaultProductQueryService,
    createGetProduct,
    createGetProductContent,
    createListProducts,
    createUpdateProduct,
    createUpsertProductContent,
} from './services/index.js';
import { createPostgresProductContentRepository, createPostgresProductRepository } from './repositories/index.js';

/**
 * @param {object} deps
 * @param {import('../../infrastructure/postgres/postgres-database.js').PostgresDatabase} deps.database
 * @param {ReturnType<typeof import('../authorization/public/index.js').createDefaultAuthorizationService>} deps.authorization
 * @param {import('../audit/public/index.js').AuditRecorder} [deps.auditRecorder]
 * @param {import('../../shared/events/event-recorder.port.js').EventRecorderPort} [deps.eventRecorder]
 * @returns {{ useCases: object, productQueryService: import('./public/index.js').DefaultProductQueryService }}
 */
export function createProductsModule(deps) {
    const products = createPostgresProductRepository();
    const productContent = createPostgresProductContentRepository();
    const sharedDeps = {
        authorization: deps.authorization,
        database: deps.database,
        products,
        ...(deps.auditRecorder === undefined ? {} : { auditRecorder: deps.auditRecorder }),
        ...(deps.eventRecorder === undefined ? {} : { eventRecorder: deps.eventRecorder })
    };
    const createProduct = createCreateProduct(sharedDeps);
    const getProduct = createGetProduct({ ...sharedDeps, database: deps.database });
    const listProducts = createListProducts({ ...sharedDeps, database: deps.database });
    const updateProduct = createUpdateProduct(sharedDeps);
    const deactivateProduct = createDeactivateProduct(sharedDeps);
    const archiveProduct = createArchiveProduct(sharedDeps);
    const upsertProductContent = createUpsertProductContent({
        ...sharedDeps,
        productContent
    });
    const getProductContent = createGetProductContent({
        ...sharedDeps,
        database: deps.database,
        productContent
    });
    const productQueryService = createDefaultProductQueryService({
        database: deps.database,
        products
    });
    const useCases = {
        createProduct,
        getProduct,
        listProducts,
        updateProduct,
        deactivateProduct,
        archiveProduct,
        upsertProductContent,
        getProductContent
    };
    return {
        useCases,
        productQueryService
    };
}

export {
    createProductEntity,
    reconstituteProduct,
    updateProductEntity,
    deactivateProductEntity,
    archiveProductEntity,
    ProductStatus,
    ProductType,
    normalizeMerchantSku,
} from './models/index.js';
