import { NotFoundError, ValidationError } from '../../../shared/errors/index.js';
import { toCancellationDto, toCancellationLineDto, } from '../views/cancellation-dto.js';
import { requireCancellationsRead } from './cancellation-permissions.js';

const DEFAULT_PAGE_SIZE = 50;
const MAX_PAGE_SIZE = 100;

function clampPageSize(pageSize) {
    const requested = pageSize ?? DEFAULT_PAGE_SIZE;
    if (!Number.isInteger(requested) || requested < 1) {
        throw new ValidationError('Page size must be a positive integer');
    }
    return Math.min(requested, MAX_PAGE_SIZE);
}

function clampPage(page) {
    const requested = page ?? 1;
    if (!Number.isInteger(requested) || requested < 1) {
        throw new ValidationError('Page must be a positive integer');
    }
    return requested;
}

/**
 * @param {object} deps
 * @param {import('../../authorization/public/index.js').AuthorizationService} deps.authorization
 * @param {import('../../../infrastructure/postgres/postgres-database.js').PostgresQueryable} deps.queryable
 * @param {import('../repositories/postgres-cancellation-repository.js').PostgresCancellationRepository} deps.cancellations
 */
export function createCancellationQueryService(deps) {
    async function getCancellationById(tenantId, cancellationId, tx) {
        const queryable = tx ?? deps.queryable;
        const cancellation = await deps.cancellations.findById(queryable, tenantId, cancellationId);
        if (cancellation === null) {
            throw new NotFoundError('Cancellation was not found', { tenantId, cancellationId });
        }
        const lines = await deps.cancellations.listLines(queryable, tenantId, cancellationId);
        return {
            ...toCancellationDto(cancellation),
            lines: lines.map(toCancellationLineDto),
        };
    }

    async function getCancellationSummaryById(tenantId, cancellationId, tx) {
        const queryable = tx ?? deps.queryable;
        const cancellation = await deps.cancellations.findById(queryable, tenantId, cancellationId);
        if (cancellation === null) {
            throw new NotFoundError('Cancellation was not found', { tenantId, cancellationId });
        }
        return toCancellationDto(cancellation);
    }

    async function listCancellations(input) {
        requireCancellationsRead(deps.authorization, input.actorPermissions);
        const page = clampPage(input.page);
        const pageSize = clampPageSize(input.pageSize);
        const filters = {
            ...(input.externalReferences === undefined ? {} : { externalReferences: input.externalReferences }),
            ...(input.orderNumbers === undefined ? {} : { orderNumbers: input.orderNumbers }),
            ...(input.externalOrderReferences === undefined
                ? {}
                : { externalOrderReferences: input.externalOrderReferences }),
            ...(input.createdAfter === undefined ? {} : { createdAfter: input.createdAfter }),
            ...(input.createdBefore === undefined ? {} : { createdBefore: input.createdBefore }),
            ...(input.updatedAfter === undefined ? {} : { updatedAfter: input.updatedAfter }),
            ...(input.updatedBefore === undefined ? {} : { updatedBefore: input.updatedBefore }),
        };
        const sortDirection = input.sortDirection ?? 'asc';
        const totalCount = await deps.cancellations.count(deps.queryable, input.tenantId, filters);
        const cancellations = await deps.cancellations.listPageOffset(deps.queryable, input.tenantId, filters, page, pageSize, sortDirection);
        const items = await Promise.all(cancellations.map(async (cancellation) => {
            const lines = await deps.cancellations.listLines(deps.queryable, input.tenantId, cancellation.id);
            return {
                ...toCancellationDto(cancellation),
                lines: lines.map(toCancellationLineDto),
            };
        }));
        return {
            items,
            totalCount,
            page,
            pageSize,
        };
    }

    return {
        getCancellationById,
        getCancellationSummaryById,
        listCancellations,
    };
}

/** @deprecated Prefer {@link createCancellationQueryService}; kept for existing import sites and JSDoc typedefs. */
export class DefaultCancellationQueryService {
    constructor(deps) {
        return createCancellationQueryService(deps);
    }
}
