import type { AuditRecorder } from '../../audit/public/index.js';
import { auditRequestFields } from '../../audit/public/index.js';
import type { AuthorizationService } from '../../authorization/public/index.js';
import { NotFoundError } from '../../../shared/errors/index.js';
import type { EventRecorder } from '../../../shared/events/index.js';
import type { TransactionManager } from '../../../shared/persistence/index.js';
import type { ListingStatus } from '../domain/listing-status.js';
import type { OfferRepository } from '../domain/offer-repository.port.js';
import { toOfferDto, type OfferDto } from './offer-dto.js';
import { offerUpdatedEvent } from './offer-events.js';
import { requireOffersUpdate } from './offer-permissions.js';

export interface UpdateOfferInput {
  readonly tenantId: string;
  readonly actorId: string;
  readonly actorKind: 'user' | 'api-key';
  readonly actorPermissions: readonly string[];
  readonly offerId: string;
  readonly externalReference?: string | null | undefined;
  readonly priceReference?: string | null | undefined;
  readonly listingStatus?: ListingStatus | undefined;
}

export interface UpdateOfferResult {
  readonly offer: OfferDto;
}

export interface UpdateOfferDependencies {
  readonly authorization: AuthorizationService;
  readonly database: TransactionManager;
  readonly offers: OfferRepository;
  readonly eventRecorder: EventRecorder;
  readonly auditRecorder?: AuditRecorder;
}

export class UpdateOffer {
  constructor(private readonly deps: UpdateOfferDependencies) {}

  async execute(input: UpdateOfferInput): Promise<UpdateOfferResult> {
    requireOffersUpdate(this.deps.authorization, input.actorPermissions);

    const externalReference =
      input.externalReference === undefined
        ? undefined
        : input.externalReference === null
          ? null
          : input.externalReference.trim() || null;

    const offer = await this.deps.database.execute(
      async (tx) => {
        const existing = await this.deps.offers.findById(tx, input.tenantId, input.offerId);
        if (existing === null) {
          throw new NotFoundError('Offer was not found', {
            tenantId: input.tenantId,
            offerId: input.offerId,
          });
        }

        const updated = existing.update(
          {
            ...(externalReference === undefined ? {} : { externalReference }),
            ...(input.priceReference === undefined ? {} : { priceReference: input.priceReference }),
            ...(input.listingStatus === undefined ? {} : { listingStatus: input.listingStatus }),
          },
          new Date(),
        );

        await this.deps.offers.update(tx, updated);

        const dto = toOfferDto(updated);
        const changes: Record<string, unknown> = {};
        if (externalReference !== undefined && externalReference !== existing.externalReference) {
          changes['externalReference'] = {
            from: existing.externalReference,
            to: externalReference,
          };
        }
        if (
          input.priceReference !== undefined &&
          input.priceReference !== existing.priceReference
        ) {
          changes['priceReference'] = {
            from: existing.priceReference,
            to: input.priceReference,
          };
        }
        if (input.listingStatus !== undefined && input.listingStatus !== existing.listingStatus) {
          changes['listingStatus'] = {
            from: existing.listingStatus,
            to: input.listingStatus,
          };
        }

        if (Object.keys(changes).length > 0) {
          await this.deps.eventRecorder.record(tx, offerUpdatedEvent(dto, changes));

          await this.deps.auditRecorder?.record(tx, {
            tenantId: input.tenantId,
            actorKind: input.actorKind,
            actorId: input.actorId,
            eventType: 'OFFER_UPDATED',
            resourceType: 'offer',
            resourceId: updated.id,
            metadata: { changes },
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
