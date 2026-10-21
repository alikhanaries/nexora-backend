import { NotFoundError, ValidationError } from '../../../shared/errors/index.js';
import { toReturnDetailDto, toReturnDto, } from '../views/return-dto.js';
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

/**
 * @param {object} deps
 * @param {import('../../authorization/public/index.js').AuthorizationService} deps.authorization
 * @param {import('../../../infrastructure/postgres/postgres-database.js').PostgresQueryable} deps.queryable
 * @param {import('../repositories/postgres-return-repository.js').PostgresReturnRepository} deps.returns
 */
export function createReturnQueryService(deps) {
    async function getReturnById(tenantId, returnId, tx) {
        const queryable = tx ?? deps.queryable;
        const returnEntity = await deps.returns.findById(queryable, tenantId, returnId);
        if (returnEntity === null) {
            throw new NotFoundError('Return was not found', { tenantId, returnId });
        }
        const lines = await deps.returns.listReturnLines(queryable, tenantId, returnId);
        return toReturnDetailDto(returnEntity, lines);
    }

    async function getReturnHeaderById(tenantId, returnId, tx) {
        const queryable = tx ?? deps.queryable;
        const returnEntity = await deps.returns.findById(queryable, tenantId, returnId);
        if (returnEntity === null) {
            throw new NotFoundError('Return was not found', { tenantId, returnId });
        }
        return toReturnDto(returnEntity);
    }

    async function findReturnByExternalReference(tenantId, externalReference, tx) {
        const queryable = tx ?? deps.queryable;
        const trimmed = externalReference.trim();
        const returnEntity = await deps.returns.findByExternalReference(queryable, tenantId, trimmed);
        if (returnEntity === null) {
            throw new NotFoundError('Return was not found', {
                tenantId,
                externalReference: trimmed,
            });
        }
        const lines = await deps.returns.listReturnLines(queryable, tenantId, returnEntity.id);
        return toReturnDetailDto(returnEntity, lines);
    }

    async function listReturns(input) {
        requireReturnsRead(deps.authorization, input.actorPermissions);
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
        const totalCount = await deps.returns.count(deps.queryable, input.tenantId, filters);
        const returns = await deps.returns.listPageOffset(deps.queryable, input.tenantId, filters, page, pageSize, sortDirection);
        const items = await Promise.all(returns.map(async (returnEntity) => {
            const lines = await deps.returns.listReturnLines(deps.queryable, input.tenantId, returnEntity.id);
            return toReturnDetailDto(returnEntity, lines);
        }));
        return {
            items,
            totalCount,
            page,
            pageSize,
        };
    }

    return {
        getReturnById,
        getReturnHeaderById,
        findReturnByExternalReference,
        listReturns,
    };
}
