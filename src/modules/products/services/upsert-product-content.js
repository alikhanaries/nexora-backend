import { randomUUID } from 'node:crypto';
import { auditRequestFields } from '../../audit/public/index.js';
import { NotFoundError } from '../../../shared/errors/index.js';
import { upsertProductContentEntity } from '../models/product-content.js';
import { toProductContentDto } from './product-dto.js';

/**
 * @param {object} deps
 * @returns {{ execute: Function }}
 */
export function createUpsertProductContent(deps) {
/** Application workflow entry for this command/query (tenant-scoped, permission-checked). */
    async function execute(input) {
        deps.authorization.requirePermission(input.actorPermissions, 'products.update');
        const now = new Date();
        const title = input.title === undefined || input.title === null ? null : input.title.trim() || null;
        const description = input.description === undefined || input.description === null
            ? null
            : input.description.trim() || null;
        const brand = input.brand === undefined || input.brand === null ? null : input.brand.trim() || null;
        const attributes = input.attributes ?? {};
        const content = await deps.database.execute(async (tx) => {
            const product = await deps.products.findById(tx, input.tenantId, input.productId);
            if (product === null) {
                throw new NotFoundError('Product was not found');
            }
            const existing = await deps.productContent.findByProductAndLocale(tx, input.tenantId, input.productId, input.locale);
            const upserted = upsertProductContentEntity({
                id: existing?.id ?? randomUUID(),
                productId: input.productId,
                tenantId: input.tenantId,
                locale: input.locale,
                title,
                description,
                brand,
                attributes,
                now,
                ...(existing === null ? {} : { existingCreatedAt: existing.createdAt }),
            });
            await deps.productContent.upsert(tx, upserted);
            const dto = toProductContentDto(upserted);
            await deps.auditRecorder?.record(tx, {
                tenantId: input.tenantId,
                actorKind: input.actorKind,
                actorId: input.actorId,
                eventType: 'PRODUCT_CONTENT_UPSERTED',
                resourceType: 'product_content',
                resourceId: upserted.id,
                metadata: { productId: input.productId, locale: input.locale },
                ...auditRequestFields(),
            });
            return dto;
        }, { tenantId: input.tenantId });
        return { content };
    }
    return { execute };
}
