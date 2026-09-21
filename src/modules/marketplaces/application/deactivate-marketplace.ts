import type { AuditRecorder } from '../../audit/public/index.js';
import { auditRequestFields } from '../../audit/public/index.js';
import type { AuthorizationService } from '../../authorization/public/index.js';
import { NotFoundError } from '../../../shared/errors/index.js';
import type { EventRecorder } from '../../../shared/events/index.js';
import type { TransactionManager } from '../../../shared/persistence/index.js';
import type { Marketplace } from '../domain/marketplace.js';
import type { MarketplaceRepository } from '../domain/marketplace-repository.port.js';
import { marketplaceStatusChangedEvent } from './marketplace-events.js';
import { requireMarketplaceManage } from './marketplace-permissions.js';

export interface DeactivateMarketplaceInput {
  readonly actorPermissions: readonly string[];
  readonly actorId: string;
  readonly actorTenantId: string;
  readonly marketplaceId: string;
}

export interface DeactivateMarketplaceResult {
  readonly marketplace: Marketplace;
}

export interface DeactivateMarketplaceDependencies {
  readonly authorization: AuthorizationService;
  readonly repository: MarketplaceRepository;
  readonly database: TransactionManager;
  readonly eventRecorder: EventRecorder;
  readonly auditRecorder?: AuditRecorder;
}

export class DeactivateMarketplace {
  constructor(private readonly deps: DeactivateMarketplaceDependencies) {}

  async execute(input: DeactivateMarketplaceInput): Promise<DeactivateMarketplaceResult> {
    requireMarketplaceManage(this.deps.authorization, input.actorPermissions);

    const marketplace = await this.deps.database.execute(async (tx) => {
      const existing = await this.deps.repository.findById(tx, input.marketplaceId);
      if (existing === null) {
        throw new NotFoundError('Marketplace was not found', {
          marketplaceId: input.marketplaceId,
        });
      }

      const previousStatus = existing.status;
      const updated = existing.deactivate(new Date());
      await this.deps.repository.update(tx, updated);

      if (previousStatus !== updated.status) {
        await this.deps.eventRecorder.record(
          tx,
          marketplaceStatusChangedEvent(updated, previousStatus),
        );
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
