import type { AuditRecorder } from '../../audit/public/index.js';
import { auditRequestFields } from '../../audit/public/index.js';
import type { AuthorizationService } from '../../authorization/public/index.js';
import type { TransactionManager } from '../../../shared/persistence/index.js';
import type { PriceDto } from './price-dto.js';
import type { PricingService } from './pricing-service.js';
import { requirePricingUpdate } from './pricing-permissions.js';

export interface DeactivatePriceInput {
  readonly tenantId: string;
  readonly actorId: string;
  readonly actorKind: 'user' | 'api-key';
  readonly actorPermissions: readonly string[];
  readonly priceId: string;
}

export interface DeactivatePriceResult {
  readonly price: PriceDto;
}

export interface DeactivatePriceDependencies {
  readonly authorization: AuthorizationService;
  readonly pricingService: PricingService;
  readonly database: TransactionManager;
  readonly auditRecorder?: AuditRecorder;
}

export class DeactivatePrice {
  constructor(private readonly deps: DeactivatePriceDependencies) {}

  async execute(input: DeactivatePriceInput): Promise<DeactivatePriceResult> {
    requirePricingUpdate(this.deps.authorization, input.actorPermissions);

    const price = await this.deps.database.execute(
      async (tx) => {
        const deactivated = await this.deps.pricingService.deactivatePrice(
          {
            tenantId: input.tenantId,
            priceId: input.priceId,
          },
          tx,
        );

        await this.deps.auditRecorder?.record(tx, {
          tenantId: input.tenantId,
          actorKind: input.actorKind,
          actorId: input.actorId,
          eventType: 'PRICE_DEACTIVATED',
          resourceType: 'price',
          resourceId: deactivated.id,
          metadata: {
            productId: deactivated.productId,
            channelId: deactivated.channelId,
          },
          ...auditRequestFields(),
        });

        return deactivated;
      },
      { tenantId: input.tenantId },
    );

    return { price };
  }
}
