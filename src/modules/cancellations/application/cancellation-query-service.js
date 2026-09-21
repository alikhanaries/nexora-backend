import { NotFoundError } from '../../../shared/errors/index.js';
import { toCancellationDto, toCancellationLineDto, } from './cancellation-dto.js';
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
}
