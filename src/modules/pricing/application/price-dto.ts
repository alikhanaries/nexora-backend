import type { Price } from '../domain/price.js';
import type { PriceStatus } from '../domain/price-status.js';

export interface PriceDto {
  readonly id: string;
  readonly tenantId: string;
  readonly productId: string;
  readonly channelId: string | null;
  readonly currency: string;
  readonly amountMinor: number;
  readonly validFrom: Date;
  readonly validTo: Date | null;
  readonly status: PriceStatus;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}

export function toPriceDto(price: Price): PriceDto {
  return {
    id: price.id,
    tenantId: price.tenantId,
    productId: price.productId,
    channelId: price.channelId,
    currency: price.currency,
    amountMinor: price.amountMinor,
    validFrom: price.validFrom,
    validTo: price.validTo,
    status: price.status,
    createdAt: price.createdAt,
    updatedAt: price.updatedAt,
  };
}
