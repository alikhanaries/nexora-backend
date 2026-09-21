import type { AuditRecorder } from '../../audit/public/index.js';
import { auditRequestFields } from '../../audit/public/index.js';
import type { AuthorizationService } from '../../authorization/public/index.js';
import type { TransactionManager } from '../../../shared/persistence/index.js';
import type { PriceDto } from './price-dto.js';
import type { PricingService } from './pricing-service.js';
import { requirePricingUpdate } from './pricing-permissions.js';

export interface UpdatePriceInput {
  readonly tenantId: string;
  readonly actorId: string;
  readonly actorKind: 'user' | 'api-key';
  readonly actorPermissions: readonly string[];
  readonly priceId: string;
  readonly amountMinor?: number | undefined;
  readonly validFrom?: Date | undefined;
  readonly validTo?: Date | null | undefined;
  readonly channelId?: string | null | undefined;
}

export interface UpdatePriceResult {
  readonly price: PriceDto;
}

export interface UpdatePriceDependencies {
  readonly authorization: AuthorizationService;
  readonly pricingService: PricingService;
  readonly database: TransactionManager;
  readonly auditRecorder?: AuditRecorder;
}

export class UpdatePrice {
  constructor(private readonly deps: UpdatePriceDependencies) {}

  async execute(input: UpdatePriceInput): Promise<UpdatePriceResult> {
    requirePricingUpdate(this.deps.authorization, input.actorPermissions);

    const price = await this.deps.database.execute(
      async (tx) => {
        const updated = await this.deps.pricingService.updatePrice(
          {
            tenantId: input.tenantId,
            priceId: input.priceId,
            ...(input.amountMinor === undefined ? {} : { amountMinor: input.amountMinor }),
            ...(input.validFrom === undefined ? {} : { validFrom: input.validFrom }),
            ...(input.validTo === undefined ? {} : { validTo: input.validTo }),
            ...(input.channelId === undefined ? {} : { channelId: input.channelId }),
          },
          tx,
        );

        await this.deps.auditRecorder?.record(tx, {
          tenantId: input.tenantId,
          actorKind: input.actorKind,
          actorId: input.actorId,
          eventType: 'PRICE_UPDATED',
          resourceType: 'price',
          resourceId: updated.id,
          metadata: {
            productId: updated.productId,
            channelId: updated.channelId,
          },
          ...auditRequestFields(),
        });

        return updated;
      },
      { tenantId: input.tenantId },
    );

    return { price };
  }
}
