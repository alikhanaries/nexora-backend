import { clampCursorLimit, decodeCursor, encodeCursor, } from '../../../shared/pagination/index.js';
import { ValidationError } from '../../../shared/errors/index.js';
import { toCancellationDto } from '../views/cancellation-dto.js';
import { requireCancellationsRead } from './cancellation-permissions.js';

/**
 * @param {object} deps
 * @returns {{ execute: Function }}
 */
export function createListCancellations(deps) {
/**
   * Cursor-paginated cancellation list for the public API (order/status filters).
   * @param {object} input tenantId, actorPermissions, optional limit/cursor/orderId/status.
   */
    async function execute(input) {
        requireCancellationsRead(deps.authorization, input.actorPermissions);
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
        const page = await deps.cancellations.listPage(deps.queryable, input.tenantId, {
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

    return { execute };
}
