import type { Transaction } from '../../../shared/persistence/index.js';
import type { CursorPage } from '../../../shared/pagination/index.js';
import type { PriceDto } from './price-dto.js';
import type { PriceListFilters } from '../domain/price-repository.port.js';

export interface CreatePriceServiceInput {
  readonly tenantId: string;
  readonly productId: string;
  readonly currency: string;
  readonly amountMinor: number;
  readonly channelId?: string | null | undefined;
  readonly validFrom?: Date | undefined;
  readonly validTo?: Date | null | undefined;
}

export interface UpdatePriceServiceInput {
  readonly tenantId: string;
  readonly priceId: string;
  readonly amountMinor?: number | undefined;
  readonly validFrom?: Date | undefined;
  readonly validTo?: Date | null | undefined;
  readonly channelId?: string | null | undefined;
}

export interface DeactivatePriceServiceInput {
  readonly tenantId: string;
  readonly priceId: string;
}

export interface ListPricesServiceInput extends PriceListFilters {
  readonly tenantId: string;
  readonly limit?: number | undefined;
  readonly cursor?: string | undefined;
}

export interface PricingService {
  getEffectivePrice(
    tenantId: string,
    productId: string,
    channelId: string,
    currency: string,
    at?: Date,
    tx?: Transaction,
  ): Promise<PriceDto | null>;

  createPrice(input: CreatePriceServiceInput, tx?: Transaction): Promise<PriceDto>;
  updatePrice(input: UpdatePriceServiceInput, tx?: Transaction): Promise<PriceDto>;
  deactivatePrice(input: DeactivatePriceServiceInput, tx?: Transaction): Promise<PriceDto>;
  listPrices(input: ListPricesServiceInput, tx?: Transaction): Promise<CursorPage<PriceDto>>;
}
