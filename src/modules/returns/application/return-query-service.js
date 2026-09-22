import { NotFoundError, ValidationError } from '../../../shared/errors/index.js';
import { toReturnDetailDto, toReturnDto, } from './return-dto.js';
import { requireReturnsRead } from './return-permissions.js';

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

export class DefaultReturnQueryService {
    deps;
    constructor(deps) {
        this.deps = deps;
    }
    async getReturnById(tenantId, returnId, tx) {
        const queryable = tx ?? this.deps.queryable;
        const returnEntity = await this.deps.returns.findById(queryable, tenantId, returnId);
        if (returnEntity === null) {
            throw new NotFoundError('Return was not found', { tenantId, returnId });
        }
        const lines = await this.deps.returns.listReturnLines(queryable, tenantId, returnId);
        return toReturnDetailDto(returnEntity, lines);
    }
    async getReturnHeaderById(tenantId, returnId, tx) {
        const queryable = tx ?? this.deps.queryable;
        const returnEntity = await this.deps.returns.findById(queryable, tenantId, returnId);
        if (returnEntity === null) {
            throw new NotFoundError('Return was not found', { tenantId, returnId });
        }
        return toReturnDto(returnEntity);
    }
    async findReturnByExternalReference(tenantId, externalReference, tx) {
        const queryable = tx ?? this.deps.queryable;
        const trimmed = externalReference.trim();
        const returnEntity = await this.deps.returns.findByExternalReference(queryable, tenantId, trimmed);
        if (returnEntity === null) {
            throw new NotFoundError('Return was not found', {
                tenantId,
                externalReference: trimmed,
            });
        }
        const lines = await this.deps.returns.listReturnLines(queryable, tenantId, returnEntity.id);
        return toReturnDetailDto(returnEntity, lines);
    }
    async listReturns(input) {
        requireReturnsRead(this.deps.authorization, input.actorPermissions);
        const page = clampPage(input.page);
        const pageSize = clampPageSize(input.pageSize);
        const filters = {
            ...(input.externalReferences === undefined ? {} : { externalReferences: input.externalReferences }),
            ...(input.orderNumbers === undefined ? {} : { orderNumbers: input.orderNumbers }),
            ...(input.externalOrderReferences === undefined
                ? {}
                : { externalOrderReferences: input.externalOrderReferences }),
            ...(input.statuses === undefined ? {} : { statuses: input.statuses }),
            ...(input.reasons === undefined ? {} : { reasons: input.reasons }),
            ...(input.createdAfter === undefined ? {} : { createdAfter: input.createdAfter }),
            ...(input.createdBefore === undefined ? {} : { createdBefore: input.createdBefore }),
            ...(input.updatedAfter === undefined ? {} : { updatedAfter: input.updatedAfter }),
            ...(input.updatedBefore === undefined ? {} : { updatedBefore: input.updatedBefore }),
        };
        const sortDirection = input.sortDirection ?? 'desc';
        const totalCount = await this.deps.returns.count(this.deps.queryable, input.tenantId, filters);
        const returns = await this.deps.returns.listPageOffset(this.deps.queryable, input.tenantId, filters, page, pageSize, sortDirection);
        const items = await Promise.all(returns.map(async (returnEntity) => {
            const lines = await this.deps.returns.listReturnLines(this.deps.queryable, input.tenantId, returnEntity.id);
            return toReturnDetailDto(returnEntity, lines);
        }));
        return {
            items,
            totalCount,
            page,
            pageSize,
        };
    }
}
