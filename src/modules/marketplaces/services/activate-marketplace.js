import { auditRequestFields } from '../../audit/public/index.js';
import { NotFoundError } from '../../../shared/errors/index.js';
import { marketplaceStatusChangedEvent } from './marketplace-events.js';
import { requireMarketplaceManage } from './marketplace-permissions.js';
export class ActivateMarketplace {
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
        requireMarketplaceManage(this.deps.authorization, input.actorPermissions);
        const marketplace = await this.deps.database.execute(async (tx) => {
            const existing = await this.deps.repository.findById(tx, input.marketplaceId);
            if (existing === null) {
                throw new NotFoundError('Marketplace was not found', {
                    marketplaceId: input.marketplaceId,
                });
            }
            const previousStatus = existing.status;
            const updated = existing.activate(new Date());
            await this.deps.repository.update(tx, updated);
            if (previousStatus !== updated.status) {
                await this.deps.eventRecorder.record(tx, marketplaceStatusChangedEvent(updated, previousStatus));
                await this.deps.auditRecorder?.record(tx, {
                    tenantId: input.actorTenantId,
                    actorKind: 'user',
                    actorId: input.actorId,
                    eventType: 'MARKETPLACE_STATUS_CHANGED',
                    resourceType: 'marketplace',
                    resourceId: updated.id,
                    metadata: {
                        previousStatus,
                        newStatus: updated.status,
                        key: updated.key,
                    },
                    ...auditRequestFields(),
                });
            }
            return updated;
        });
        return { marketplace };
    }
}
