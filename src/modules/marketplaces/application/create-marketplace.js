import { randomUUID } from 'node:crypto';
import { ConflictError, ValidationError } from '../../../shared/errors/index.js';
import { Marketplace } from '../domain/marketplace.js';
import { normalizeMarketplaceKey, validateMarketplaceKey } from '../domain/marketplace-key.js';
import { marketplaceCreatedEvent } from './marketplace-events.js';
import { requireMarketplaceManage } from './marketplace-permissions.js';
export class CreateMarketplace {
    deps;
    constructor(deps) {
        this.deps = deps;
    }
    async execute(input) {
        requireMarketplaceManage(this.deps.authorization, input.actorPermissions);
        const name = input.name.trim();
        if (name.length === 0) {
            throw new ValidationError('Marketplace name is required');
        }
        validateMarketplaceKey(input.key);
        const key = normalizeMarketplaceKey(input.key);
        const now = new Date();
        const marketplace = Marketplace.create({
            id: randomUUID(),
            key,
            name,
            createdAt: now,
        });
        await this.deps.database.execute(async (tx) => {
            const existing = await this.deps.repository.findByKey(tx, key);
            if (existing !== null) {
                throw new ConflictError('A marketplace with this key already exists', { key });
            }
            await this.deps.repository.insert(tx, marketplace);
            await this.deps.eventRecorder.record(tx, marketplaceCreatedEvent(marketplace));
        });
        return { marketplace };
    }
}
