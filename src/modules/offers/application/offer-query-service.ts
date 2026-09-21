import { BusinessRuleError, NotFoundError } from '../../../shared/errors/index.js';
import type { Queryable, Transaction } from '../../../shared/persistence/index.js';
import { OfferStatus } from '../domain/offer-status.js';
import type { OfferRepository } from '../domain/offer-repository.port.js';
import { toOfferDto, type OfferDto } from './offer-dto.js';

export interface OfferQueryService {
  getOfferById(tenantId: string, offerId: string, tx?: Transaction): Promise<OfferDto>;
  getOfferForProductAndChannel(
    tenantId: string,
    productId: string,
    channelId: string,
    tx?: Transaction,
  ): Promise<OfferDto | null>;
  getOffersByProduct(
    tenantId: string,
    productId: string,
    tx?: Transaction,
  ): Promise<readonly OfferDto[]>;
  verifyOfferUsable(tenantId: string, offerId: string, tx?: Transaction): Promise<OfferDto>;
}

export interface DefaultOfferQueryServiceDeps {
  readonly queryable: Queryable;
  readonly offers: OfferRepository;
}

export class DefaultOfferQueryService implements OfferQueryService {
  constructor(private readonly deps: DefaultOfferQueryServiceDeps) {}

  async getOfferById(tenantId: string, offerId: string, tx?: Transaction): Promise<OfferDto> {
    const queryable = tx ?? this.deps.queryable;
    const offer = await this.deps.offers.findById(queryable, tenantId, offerId);
    if (offer === null) {
      throw new NotFoundError('Offer was not found', { tenantId, offerId });
    }
    return toOfferDto(offer);
  }

  async getOfferForProductAndChannel(
    tenantId: string,
    productId: string,
    channelId: string,
    tx?: Transaction,
  ): Promise<OfferDto | null> {
    const queryable = tx ?? this.deps.queryable;
    const offer = await this.deps.offers.findByProductAndChannel(
      queryable,
      tenantId,
      productId,
      channelId,
    );
    return offer === null ? null : toOfferDto(offer);
  }

  async getOffersByProduct(
    tenantId: string,
    productId: string,
    tx?: Transaction,
  ): Promise<readonly OfferDto[]> {
    const queryable = tx ?? this.deps.queryable;
    const offers = await this.deps.offers.listByProduct(queryable, tenantId, productId);
    return offers.map(toOfferDto);
  }

  async verifyOfferUsable(tenantId: string, offerId: string, tx?: Transaction): Promise<OfferDto> {
    const offer = await this.getOfferById(tenantId, offerId, tx);
    if (offer.status !== OfferStatus.ACTIVE) {
      throw new BusinessRuleError('Offer is not usable', {
        tenantId,
        offerId,
        status: offer.status,
      });
    }
    return offer;
  }
}
