import { NotFoundError, ValidationError } from '../../../shared/errors/index.js';
import { marketplaceUpdatedEvent } from './marketplace-events.js';
import { requireMarketplaceManage } from './marketplace-permissions.js';
export class UpdateMarketplace {
    deps;
    constructor(deps) {
        this.deps = deps;
    }
    async execute(input) {
        requireMarketplaceManage(this.deps.authorization, input.actorPermissions);
        if (input.name === undefined) {
            throw new ValidationError('At least one field must be provided');
        }
        const name = input.name.trim();
        if (name.length === 0) {
            throw new ValidationError('Marketplace name is required');
        }
        const marketplace = await this.deps.database.execute(async (tx) => {
            const existing = await this.deps.repository.findById(tx, input.marketplaceId);
            if (existing === null) {
                throw new NotFoundError('Marketplace was not found', {
                    marketplaceId: input.marketplaceId,
                });
            }
            if (existing.name === name) {
                return existing;
            }
            const updated = existing.updateName(name, new Date());
            await this.deps.repository.update(tx, updated);
            await this.deps.eventRecorder.record(tx, marketplaceUpdatedEvent(updated));
            return updated;
        });
        return { marketplace };
    }
}
