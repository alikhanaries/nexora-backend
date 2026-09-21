import { randomUUID } from 'node:crypto';
import type { AuditRecorder } from '../../audit/public/index.js';
import { auditRequestFields } from '../../audit/public/index.js';
import type { AuthorizationService } from '../../authorization/public/index.js';
import type { ChannelQueryService } from '../../channels/public/index.js';
import type { ProductQueryService } from '../../products/public/index.js';
import { ConflictError, NotFoundError } from '../../../shared/errors/index.js';
import type { EventRecorder } from '../../../shared/events/index.js';
import type { TransactionManager } from '../../../shared/persistence/index.js';
import { Offer } from '../domain/offer.js';
import type { OfferRepository } from '../domain/offer-repository.port.js';
import { toOfferDto, type OfferDto } from './offer-dto.js';
import { offerCreatedEvent } from './offer-events.js';
import { requireOffersCreate } from './offer-permissions.js';

export interface CreateOfferInput {
  readonly tenantId: string;
  readonly actorId: string;
  readonly actorKind: 'user' | 'api-key';
  readonly actorPermissions: readonly string[];
  readonly productId: string;
  readonly channelId: string;
  readonly externalReference?: string | null | undefined;
  readonly priceReference?: string | null | undefined;
}

export interface CreateOfferResult {
  readonly offer: OfferDto;
}

export interface CreateOfferDependencies {
  readonly authorization: AuthorizationService;
  readonly database: TransactionManager;
  readonly offers: OfferRepository;
  readonly productQueryService: ProductQueryService;
  readonly channelQueryService: ChannelQueryService;
  readonly eventRecorder: EventRecorder;
  readonly auditRecorder?: AuditRecorder;
}

export class CreateOffer {
  constructor(private readonly deps: CreateOfferDependencies) {}

  async execute(input: CreateOfferInput): Promise<CreateOfferResult> {
    requireOffersCreate(this.deps.authorization, input.actorPermissions);

    const product = await this.deps.productQueryService.getProductById(
      input.tenantId,
      input.productId,
    );
    if (product === null) {
      throw new NotFoundError('Product was not found', {
        tenantId: input.tenantId,
        productId: input.productId,
      });
    }

    await this.deps.channelQueryService.verifyChannelBelongsToTenant(
      input.tenantId,
      input.channelId,
    );

    const externalReference =
      input.externalReference === undefined || input.externalReference === null
        ? null
        : input.externalReference.trim() || null;

    const now = new Date();
    const offer = Offer.create({
      id: randomUUID(),
      tenantId: input.tenantId,
      productId: input.productId,
      channelId: input.channelId,
      externalReference,
      ...(input.priceReference === undefined ? {} : { priceReference: input.priceReference }),
      createdAt: now,
    });

    const saved = await this.deps.database.execute(
      async (tx) => {
        const existing = await this.deps.offers.findByProductAndChannel(
          tx,
          input.tenantId,
          input.productId,
          input.channelId,
        );
        if (existing !== null) {
          throw new ConflictError('An offer already exists for this product and channel', {
            productId: input.productId,
            channelId: input.channelId,
          });
        }

        await this.deps.offers.insert(tx, offer);
        const dto = toOfferDto(offer);
        await this.deps.eventRecorder.record(tx, offerCreatedEvent(dto));

        await this.deps.auditRecorder?.record(tx, {
          tenantId: input.tenantId,
          actorKind: input.actorKind,
          actorId: input.actorId,
          eventType: 'OFFER_CREATED',
          resourceType: 'offer',
          resourceId: offer.id,
          metadata: {
            productId: offer.productId,
            channelId: offer.channelId,
          },
          ...auditRequestFields(),
        });

        return dto;
      },
      { tenantId: input.tenantId },
    );

    return { offer: saved };
  }
}
