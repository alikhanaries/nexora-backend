import { randomUUID } from 'node:crypto';
import { auditRequestFields } from '../../audit/public/index.js';
import { ConflictError } from '../../../shared/errors/index.js';
import { createProductEntity } from '../models/product.js';
import { ProductType } from '../models/product-type.js';
import { normalizeMerchantSku, validateMerchantSku } from '../models/merchant-sku.js';
import { toProductDto } from './product-dto.js';
import { productCreatedEvent } from './product-events.js';

/**
 * @param {object} deps
 * @returns {{ execute: Function }}
 */
export function createCreateProduct(deps) {
/** Application workflow entry for this command/query (tenant-scoped, permission-checked). */
    async function execute(input) {
        deps.authorization.requirePermission(input.actorPermissions, 'products.create');
        const merchantSku = normalizeMerchantSku(input.merchantSku);
        validateMerchantSku(merchantSku);
        const externalReference = input.externalReference === undefined || input.externalReference === null
            ? null
            : input.externalReference.trim() || null;
        const now = new Date();
        const product = createProductEntity({
            id: randomUUID(),
            tenantId: input.tenantId,
            merchantSku,
            externalReference,
            productType: input.productType ?? ProductType.STANDARD,
            createdAt: now,
        });
        const saved = await deps.database.execute(async (tx) => {
            const existing = await deps.products.findBySku(tx, input.tenantId, merchantSku);
            if (existing !== null) {
                throw new ConflictError('A product with this merchant SKU already exists', {
                    merchantSku,
                });
            }
            await deps.products.insert(tx, product);
            const dto = toProductDto(product);
            await deps.eventRecorder?.record(tx, productCreatedEvent(dto));
            await deps.auditRecorder?.record(tx, {
                tenantId: input.tenantId,
                actorKind: input.actorKind,
                actorId: input.actorId,
                eventType: 'PRODUCT_CREATED',
                resourceType: 'product',
                resourceId: product.id,
                metadata: {
                    merchantSku: product.merchantSku,
                    productType: product.productType,
                },
                ...auditRequestFields(),
            });
            return dto;
        }, { tenantId: input.tenantId });
        return { product: saved };
    }
    return { execute };
}
