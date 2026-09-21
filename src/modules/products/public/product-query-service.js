/**
 * @typedef {object} ProductQueryService
 * @property {(tenantId: string, productId: string, tx?: object) => Promise<object|null>} getProductById
 * @property {(tenantId: string, merchantSku: string, tx?: object) => Promise<object|null>} getProductBySku
 * @property {(tenantId: string, productIds: string[], tx?: object) => Promise<object[]>} getProductsByIds
 * @property {(tenantId: string, productId: string, tx?: object) => Promise<boolean>} verifyProductBelongsToTenant
 */
export { DefaultProductQueryService } from '../application/default-product-query-service.js';
