import { requireReturnsRead } from './return-permissions.js';
export class GetReturn {
    deps;
    constructor(deps) {
        this.deps = deps;
    }
    async execute(input) {
        requireReturnsRead(this.deps.authorization, input.actorPermissions);
        const returnDetail = await this.deps.returnQueryService.getReturnById(input.tenantId, input.returnId);
        return { return: returnDetail };
    }
}
