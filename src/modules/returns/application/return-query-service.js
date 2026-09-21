import { NotFoundError } from '../../../shared/errors/index.js';
import { toReturnDetailDto, toReturnDto, } from './return-dto.js';
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
}
