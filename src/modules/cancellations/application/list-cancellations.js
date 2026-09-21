import { clampCursorLimit, decodeCursor, encodeCursor, } from '../../../shared/pagination/index.js';
import { ValidationError } from '../../../shared/errors/index.js';
import { toCancellationDto } from './cancellation-dto.js';
import { requireCancellationsRead } from './cancellation-permissions.js';
export class ListCancellations {
    deps;
    constructor(deps) {
        this.deps = deps;
    }
    async execute(input) {
        requireCancellationsRead(this.deps.authorization, input.actorPermissions);
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
        const page = await this.deps.cancellations.listPage(this.deps.queryable, input.tenantId, {
            ...(input.orderId === undefined ? {} : { orderId: input.orderId }),
            ...(input.status === undefined ? {} : { status: input.status }),
        }, fetchLimit, cursorCreatedAt, cursorId);
        const hasMore = page.items.length > limit;
        const items = hasMore ? page.items.slice(0, limit) : page.items;
        const last = items.at(-1);
        return {
            items: items.map(toCancellationDto),
            hasMore,
            nextCursor: hasMore && last !== undefined
                ? encodeCursor([last.createdAt.toISOString(), last.id])
                : null,
        };
    }
}
