import { AuthorizationError } from '../../../../shared/errors/index.js';
export class ListApiKeysUseCase {
    deps;
    constructor(deps) {
        this.deps = deps;
    }
    async execute(input) {
        if (!input.actorPermissions.includes('api_keys.read')) {
            throw new AuthorizationError('Missing required permission: api_keys.read');
        }
        return this.deps.db.execute(async (tx) => this.deps.apiKeys.listByTenant(tx, input.tenantId), {
            tenantId: input.tenantId,
        });
    }
}
