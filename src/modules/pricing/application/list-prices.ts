import type { AuthorizationService } from '../../authorization/public/index.js';
import type { CursorPage } from '../../../shared/pagination/index.js';
import type { PriceStatus } from '../domain/price-status.js';
import type { PriceDto } from './price-dto.js';
import type { PricingService } from './pricing-service.js';
import { requirePricingRead } from './pricing-permissions.js';

export interface ListPricesInput {
  readonly tenantId: string;
  readonly actorPermissions: readonly string[];
  readonly limit?: number | undefined;
  readonly cursor?: string | undefined;
  readonly productId?: string | undefined;
  readonly channelId?: string | null | undefined;
  readonly currency?: string | undefined;
  readonly status?: PriceStatus | undefined;
}

export interface ListPricesDependencies {
  readonly authorization: AuthorizationService;
  readonly pricingService: PricingService;
}

export class ListPrices {
  constructor(private readonly deps: ListPricesDependencies) {}

  async execute(input: ListPricesInput): Promise<CursorPage<PriceDto>> {
    requirePricingRead(this.deps.authorization, input.actorPermissions);

    return this.deps.pricingService.listPrices({
      tenantId: input.tenantId,
      ...(input.limit === undefined ? {} : { limit: input.limit }),
      ...(input.cursor === undefined ? {} : { cursor: input.cursor }),
      ...(input.productId === undefined ? {} : { productId: input.productId }),
      ...(input.channelId === undefined ? {} : { channelId: input.channelId }),
      ...(input.currency === undefined ? {} : { currency: input.currency }),
      ...(input.status === undefined ? {} : { status: input.status }),
    });
  }
}
