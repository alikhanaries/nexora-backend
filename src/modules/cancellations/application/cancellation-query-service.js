import { NotFoundError, ValidationError } from '../../../shared/errors/index.js';
import { toCancellationDto, toCancellationLineDto, } from './cancellation-dto.js';
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

export class DefaultCancellationQueryService {
    deps;
    constructor(deps) {
        this.deps = deps;
    }
    async getCancellationById(tenantId, cancellationId, tx) {
        const queryable = tx ?? this.deps.queryable;
        const cancellation = await this.deps.cancellations.findById(queryable, tenantId, cancellationId);
        if (cancellation === null) {
            throw new NotFoundError('Cancellation was not found', { tenantId, cancellationId });
        }
        const lines = await this.deps.cancellations.listLines(queryable, tenantId, cancellationId);
        return {
            ...toCancellationDto(cancellation),
            lines: lines.map(toCancellationLineDto),
        };
    }
    async getCancellationSummaryById(tenantId, cancellationId, tx) {
        const queryable = tx ?? this.deps.queryable;
        const cancellation = await this.deps.cancellations.findById(queryable, tenantId, cancellationId);
        if (cancellation === null) {
            throw new NotFoundError('Cancellation was not found', { tenantId, cancellationId });
        }
        return toCancellationDto(cancellation);
    }
    async listCancellations(input) {
        requireCancellationsRead(this.deps.authorization, input.actorPermissions);
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
        const totalCount = await this.deps.cancellations.count(this.deps.queryable, input.tenantId, filters);
        const cancellations = await this.deps.cancellations.listPageOffset(this.deps.queryable, input.tenantId, filters, page, pageSize, sortDirection);
        const items = await Promise.all(cancellations.map(async (cancellation) => {
            const lines = await this.deps.cancellations.listLines(this.deps.queryable, input.tenantId, cancellation.id);
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
}
