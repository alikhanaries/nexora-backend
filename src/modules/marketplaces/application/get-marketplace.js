import { NotFoundError } from '../../../shared/errors/index.js';
import { requireMarketplaceRead } from './marketplace-permissions.js';
export class GetMarketplace {
    deps;
    constructor(deps) {
        this.deps = deps;
    }
    async execute(input) {
        requireMarketplaceRead(this.deps.authorization, input.actorPermissions);
        const marketplace = await this.deps.repository.findById(this.deps.queryable, input.marketplaceId);
        if (marketplace === null) {
            throw new NotFoundError('Marketplace was not found', { marketplaceId: input.marketplaceId });
        }
        return { marketplace };
    }
}
