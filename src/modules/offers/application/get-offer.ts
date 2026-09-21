import type { AuthorizationService } from '../../authorization/public/index.js';
import type { OfferQueryService } from './offer-query-service.js';
import { requireOffersRead } from './offer-permissions.js';
import type { OfferDto } from './offer-dto.js';

export interface GetOfferInput {
  readonly tenantId: string;
  readonly actorPermissions: readonly string[];
  readonly offerId: string;
}

export interface GetOfferResult {
  readonly offer: OfferDto;
}

export interface GetOfferDependencies {
  readonly authorization: AuthorizationService;
  readonly offerQueryService: OfferQueryService;
}

export class GetOffer {
  constructor(private readonly deps: GetOfferDependencies) {}

  async execute(input: GetOfferInput): Promise<GetOfferResult> {
    requireOffersRead(this.deps.authorization, input.actorPermissions);

    const offer = await this.deps.offerQueryService.getOfferById(input.tenantId, input.offerId);

    return { offer };
  }
}
