import { randomUUID } from 'node:crypto';
import { auditRequestFields } from '../../audit/public/index.js';
import { NotFoundError } from '../../../shared/errors/index.js';
import { ProductContent } from '../domain/product-content.js';
import { toProductContentDto } from './product-dto.js';
export class UpsertProductContent {
    deps;
    constructor(deps) {
        this.deps = deps;
    }
    async execute(input) {
        this.deps.authorization.requirePermission(input.actorPermissions, 'products.update');
        const now = new Date();
        const title = input.title === undefined || input.title === null ? null : input.title.trim() || null;
        const description = input.description === undefined || input.description === null
            ? null
            : input.description.trim() || null;
        const brand = input.brand === undefined || input.brand === null ? null : input.brand.trim() || null;
        const attributes = input.attributes ?? {};
        const content = await this.deps.database.execute(async (tx) => {
            const product = await this.deps.products.findById(tx, input.tenantId, input.productId);
            if (product === null) {
                throw new NotFoundError('Product was not found');
            }
            const existing = await this.deps.productContent.findByProductAndLocale(tx, input.tenantId, input.productId, input.locale);
            const upserted = ProductContent.upsert({
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
            await this.deps.productContent.upsert(tx, upserted);
            const dto = toProductContentDto(upserted);
            await this.deps.auditRecorder?.record(tx, {
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
}
