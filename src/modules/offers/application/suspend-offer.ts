import type { AuditRecorder } from '../../audit/public/index.js';
import { auditRequestFields } from '../../audit/public/index.js';
import type { AuthorizationService } from '../../authorization/public/index.js';
import { NotFoundError } from '../../../shared/errors/index.js';
import type { EventRecorder } from '../../../shared/events/index.js';
import type { TransactionManager } from '../../../shared/persistence/index.js';
import type { OfferRepository } from '../domain/offer-repository.port.js';
import { toOfferDto, type OfferDto } from './offer-dto.js';
import { offerStatusChangedEvent } from './offer-events.js';
import { requireOffersUpdate } from './offer-permissions.js';

export interface SuspendOfferInput {
  readonly tenantId: string;
  readonly actorId: string;
  readonly actorKind: 'user' | 'api-key';
  readonly actorPermissions: readonly string[];
  readonly offerId: string;
}

export interface SuspendOfferResult {
  readonly offer: OfferDto;
}

export interface SuspendOfferDependencies {
  readonly authorization: AuthorizationService;
  readonly database: TransactionManager;
  readonly offers: OfferRepository;
  readonly eventRecorder: EventRecorder;
  readonly auditRecorder?: AuditRecorder;
}

export class SuspendOffer {
  constructor(private readonly deps: SuspendOfferDependencies) {}

  async execute(input: SuspendOfferInput): Promise<SuspendOfferResult> {
    requireOffersUpdate(this.deps.authorization, input.actorPermissions);

    const offer = await this.deps.database.execute(
      async (tx) => {
        const existing = await this.deps.offers.findById(tx, input.tenantId, input.offerId);
        if (existing === null) {
          throw new NotFoundError('Offer was not found', {
            tenantId: input.tenantId,
            offerId: input.offerId,
          });
        }

        const previousStatus = existing.status;
        const updated = existing.suspend(new Date());
        await this.deps.offers.update(tx, updated);

        const dto = toOfferDto(updated);

        if (previousStatus !== updated.status) {
          await this.deps.eventRecorder.record(tx, offerStatusChangedEvent(dto, previousStatus));

          await this.deps.auditRecorder?.record(tx, {
            tenantId: input.tenantId,
            actorKind: input.actorKind,
            actorId: input.actorId,
            eventType: 'OFFER_STATUS_CHANGED',
            resourceType: 'offer',
            resourceId: updated.id,
            metadata: {
              previousStatus,
              newStatus: updated.status,
            },
            ...auditRequestFields(),
          });
        }

        return dto;
      },
      { tenantId: input.tenantId },
    );

    return { offer };
  }
}
