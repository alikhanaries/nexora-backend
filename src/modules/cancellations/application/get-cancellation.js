import { requireCancellationsRead } from './cancellation-permissions.js';
export class GetCancellation {
    deps;
    constructor(deps) {
        this.deps = deps;
    }
    async execute(input) {
        requireCancellationsRead(this.deps.authorization, input.actorPermissions);
        const cancellation = await this.deps.cancellationQueryService.getCancellationById(input.tenantId, input.cancellationId);
        return { cancellation };
    }
}
