import type { AuditRecorder } from '../../audit/public/index.js';
import { auditRequestFields } from '../../audit/public/index.js';
import type { AuthorizationService } from '../../authorization/public/index.js';
import type { ChannelQueryService } from '../../channels/public/index.js';
import type { PricingService } from '../../pricing/public/index.js';
import type { ProductQueryService } from '../../products/public/index.js';
import { BusinessRuleError, NotFoundError } from '../../../shared/errors/index.js';
import type { EventRecorder } from '../../../shared/events/index.js';
import type { TransactionManager } from '../../../shared/persistence/index.js';
import type { OfferRepository } from '../domain/offer-repository.port.js';
import { toOfferDto, type OfferDto } from './offer-dto.js';
import { offerStatusChangedEvent } from './offer-events.js';
import { requireOffersUpdate } from './offer-permissions.js';

export interface ActivateOfferInput {
  readonly tenantId: string;
  readonly actorId: string;
  readonly actorKind: 'user' | 'api-key';
  readonly actorPermissions: readonly string[];
  readonly offerId: string;
  readonly resolvePricing?: boolean | undefined;
  readonly currency?: string | undefined;
}

export interface ActivateOfferResult {
  readonly offer: OfferDto;
}

export interface ActivateOfferDependencies {
  readonly authorization: AuthorizationService;
  readonly database: TransactionManager;
  readonly offers: OfferRepository;
  readonly productQueryService: ProductQueryService;
  readonly channelQueryService: ChannelQueryService;
  readonly pricingService: PricingService;
  readonly eventRecorder: EventRecorder;
  readonly auditRecorder?: AuditRecorder;
}

export class ActivateOffer {
  constructor(private readonly deps: ActivateOfferDependencies) {}

  async execute(input: ActivateOfferInput): Promise<ActivateOfferResult> {
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

        const product = await this.deps.productQueryService.getProductById(
          input.tenantId,
          existing.productId,
          tx,
        );
        if (product === null) {
          throw new NotFoundError('Product was not found', {
            tenantId: input.tenantId,
            productId: existing.productId,
          });
        }
        if (product.status !== 'ACTIVE') {
          throw new BusinessRuleError('Product must be active to activate an offer', {
            productId: product.id,
            status: product.status,
          });
        }

        await this.deps.channelQueryService.verifyChannelUsable(
          input.tenantId,
          existing.channelId,
          tx,
        );

        if (input.resolvePricing === true) {
          if (input.currency === undefined) {
            throw new BusinessRuleError('currency is required when resolvePricing is true');
          }
          const effective = await this.deps.pricingService.getEffectivePrice(
            input.tenantId,
            existing.productId,
            existing.channelId,
            input.currency,
            new Date(),
            tx,
          );
          if (effective === null) {
            throw new BusinessRuleError('No effective price found for this offer', {
              productId: existing.productId,
              channelId: existing.channelId,
              currency: input.currency,
            });
          }
        }

        const previousStatus = existing.status;
        const updated = existing.activate(new Date());
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
              productId: updated.productId,
              channelId: updated.channelId,
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
