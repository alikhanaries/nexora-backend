import type { PriceDto } from '../application/price-dto.js';
import type { priceResponseSchema } from './price.schemas.js';
import type { z } from 'zod';

export type PriceResponse = z.infer<typeof priceResponseSchema>;

export function toPriceResponse(price: PriceDto): PriceResponse {
  return {
    id: price.id,
    tenantId: price.tenantId,
    productId: price.productId,
    channelId: price.channelId,
    currency: price.currency,
    amountMinor: price.amountMinor,
    validFrom: price.validFrom.toISOString(),
    validTo: price.validTo?.toISOString() ?? null,
    status: price.status,
    createdAt: price.createdAt.toISOString(),
    updatedAt: price.updatedAt.toISOString(),
  };
}
