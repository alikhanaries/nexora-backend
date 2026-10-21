import { requireMarketplaceRead } from './marketplace-permissions.js';
export class ListMarketplaces {
    deps;
    /**
     * Injects module dependencies (database, repositories, authorization, event recorder).
     */
    constructor(deps) {
        this.deps = deps;
    }
    /**
     * Use-case entry: permission check, transactional persistence, domain events/audit when applicable.
     */
    async execute(input) {
        requireMarketplaceRead(this.deps.authorization, input.actorPermissions);
        const marketplaces = await this.deps.repository.list(this.deps.queryable, {
            ...(input.status === undefined ? {} : { status: input.status }),
        });
        return { marketplaces };
    }
}
