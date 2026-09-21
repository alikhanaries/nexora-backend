import { ValidationError } from '../../../shared/errors/index.js';
import { clampCursorLimit, decodeCursor, encodeCursor, } from '../../../shared/pagination/index.js';
import { toProductDto } from './product-dto.js';
export class ListProducts {
    deps;
    constructor(deps) {
        this.deps = deps;
    }
    async execute(input) {
        this.deps.authorization.requirePermission(input.actorPermissions, 'products.read');
        const limit = clampCursorLimit(input.limit);
        const fetchLimit = limit + 1;
        let cursorCreatedAt = null;
        let cursorId = null;
        if (input.cursor !== undefined) {
            const parts = decodeCursor(input.cursor);
            if (parts.length !== 2) {
                throw new ValidationError('Invalid cursor');
            }
            cursorCreatedAt = new Date(parts[0] ?? '');
            cursorId = parts[1] ?? null;
        }
        const page = await this.deps.products.listPage(this.deps.database, input.tenantId, { status: input.status }, fetchLimit, cursorCreatedAt, cursorId);
        const hasMore = page.items.length > limit;
        const items = hasMore ? page.items.slice(0, limit) : page.items;
        const last = items.at(-1);
        return {
            items: items.map(toProductDto),
            hasMore,
            nextCursor: hasMore && last !== undefined
                ? encodeCursor([last.createdAt.toISOString(), last.id])
                : null,
        };
    }
}
