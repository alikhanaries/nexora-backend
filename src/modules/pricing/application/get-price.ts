import type { AuthorizationService } from '../../authorization/public/index.js';
import { NotFoundError } from '../../../shared/errors/index.js';
import type { Queryable } from '../../../shared/persistence/index.js';
import type { PriceRepository } from '../domain/price-repository.port.js';
import { toPriceDto, type PriceDto } from './price-dto.js';
import { requirePricingRead } from './pricing-permissions.js';

export interface GetPriceInput {
  readonly tenantId: string;
  readonly actorPermissions: readonly string[];
  readonly priceId: string;
}

export interface GetPriceResult {
  readonly price: PriceDto;
}

export interface GetPriceDependencies {
  readonly authorization: AuthorizationService;
  readonly queryable: Queryable;
  readonly prices: PriceRepository;
}

export class GetPrice {
  constructor(private readonly deps: GetPriceDependencies) {}

  async execute(input: GetPriceInput): Promise<GetPriceResult> {
    requirePricingRead(this.deps.authorization, input.actorPermissions);

    const price = await this.deps.prices.findById(
      this.deps.queryable,
      input.tenantId,
      input.priceId,
    );
    if (price === null) {
      throw new NotFoundError('Price was not found', {
        tenantId: input.tenantId,
        priceId: input.priceId,
      });
    }

    return { price: toPriceDto(price) };
  }
}
