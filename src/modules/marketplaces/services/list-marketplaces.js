import { requireMarketplaceRead } from './marketplace-permissions.js';
export class ListMarketplaces {
    deps;
    constructor(deps) {
        this.deps = deps;
    }
    async execute(input) {
        requireMarketplaceRead(this.deps.authorization, input.actorPermissions);
        const marketplaces = await this.deps.repository.list(this.deps.queryable, {
            ...(input.status === undefined ? {} : { status: input.status }),
        });
        return { marketplaces };
    }
}
