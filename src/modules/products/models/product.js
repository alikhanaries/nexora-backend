import { BusinessRuleError } from '../../../shared/errors/index.js';
import { ProductStatus } from './product-status.js';

/**
 * @typedef {{
 *   id: string,
 *   tenantId: string,
 *   merchantSku: string,
 *   externalReference: string | null,
 *   productType: string,
 *   status: string,
 *   createdAt: Date,
 *   updatedAt: Date,
 * }} Product
 */

/**
 * @param {{ id: string, tenantId: string, merchantSku: string, externalReference: string | null, productType: string, createdAt: Date }} props
 * @returns {Product}
 */
export function createProductEntity(props) {
    return {
        id: props.id,
        tenantId: props.tenantId,
        merchantSku: props.merchantSku,
        externalReference: props.externalReference,
        productType: props.productType,
        status: ProductStatus.ACTIVE,
        createdAt: props.createdAt,
        updatedAt: props.createdAt,
    };
}

/**
 * @param {Product} props
 * @returns {Product}
 */
export function reconstituteProduct(props) {
    return {
        id: props.id,
        tenantId: props.tenantId,
        merchantSku: props.merchantSku,
        externalReference: props.externalReference,
        productType: props.productType,
        status: props.status,
        createdAt: props.createdAt,
        updatedAt: props.updatedAt,
    };
}

/**
 * @param {Product} product
 */
export function assertProductMutable(product) {
    if (product.status === ProductStatus.ARCHIVED) {
        throw new BusinessRuleError('Archived products cannot be modified');
    }
}

/**
 * @param {Product} product
 * @param {string} status
 * @param {Date} updatedAt
 * @returns {Product}
 */
function withProductStatus(product, status, updatedAt) {
    return {
        id: product.id,
        tenantId: product.tenantId,
        merchantSku: product.merchantSku,
        externalReference: product.externalReference,
        productType: product.productType,
        status,
        createdAt: product.createdAt,
        updatedAt,
    };
}

/**
 * @param {Product} product
 * @param {{ externalReference?: string | null, productType?: string }} fields
 * @param {Date} at
 * @returns {Product}
 */
export function updateProductEntity(product, fields, at) {
    assertProductMutable(product);
    return {
        id: product.id,
        tenantId: product.tenantId,
        merchantSku: product.merchantSku,
        externalReference: fields.externalReference === undefined ? product.externalReference : fields.externalReference,
        productType: fields.productType ?? product.productType,
        status: product.status,
        createdAt: product.createdAt,
        updatedAt: at,
    };
}

/**
 * @param {Product} product
 * @param {Date} at
 * @returns {Product}
 */
export function deactivateProductEntity(product, at) {
    if (product.status === ProductStatus.ARCHIVED) {
        throw new BusinessRuleError('Cannot deactivate an archived product');
    }
    if (product.status === ProductStatus.INACTIVE) {
        throw new BusinessRuleError('Product is already inactive');
    }
    return withProductStatus(product, ProductStatus.INACTIVE, at);
}

/**
 * @param {Product} product
 * @param {Date} at
 * @returns {Product}
 */
export function archiveProductEntity(product, at) {
    if (product.status === ProductStatus.ARCHIVED) {
        throw new BusinessRuleError('Product is already archived');
    }
    return withProductStatus(product, ProductStatus.ARCHIVED, at);
}
