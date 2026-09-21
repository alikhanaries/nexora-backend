import type { AuditRecorder } from '../../audit/public/index.js';
import { auditRequestFields } from '../../audit/public/index.js';
import type { AuthorizationService } from '../../authorization/public/index.js';
import type { TransactionManager } from '../../../shared/persistence/index.js';
import type { PriceDto } from './price-dto.js';
import type { PricingService } from './pricing-service.js';
import { requirePricingCreate } from './pricing-permissions.js';

export interface CreatePriceInput {
  readonly tenantId: string;
  readonly actorId: string;
  readonly actorKind: 'user' | 'api-key';
  readonly actorPermissions: readonly string[];
  readonly productId: string;
  readonly currency: string;
  readonly amountMinor: number;
  readonly channelId?: string | null | undefined;
  readonly validFrom?: Date | undefined;
  readonly validTo?: Date | null | undefined;
}

export interface CreatePriceResult {
  readonly price: PriceDto;
}

export interface CreatePriceDependencies {
  readonly authorization: AuthorizationService;
  readonly pricingService: PricingService;
  readonly database: TransactionManager;
  readonly auditRecorder?: AuditRecorder;
}

export class CreatePrice {
  constructor(private readonly deps: CreatePriceDependencies) {}

  async execute(input: CreatePriceInput): Promise<CreatePriceResult> {
    requirePricingCreate(this.deps.authorization, input.actorPermissions);

    const price = await this.deps.database.execute(
      async (tx) => {
        const created = await this.deps.pricingService.createPrice(
          {
            tenantId: input.tenantId,
            productId: input.productId,
            currency: input.currency,
            amountMinor: input.amountMinor,
            ...(input.channelId === undefined ? {} : { channelId: input.channelId }),
            ...(input.validFrom === undefined ? {} : { validFrom: input.validFrom }),
            ...(input.validTo === undefined ? {} : { validTo: input.validTo }),
          },
          tx,
        );

        await this.deps.auditRecorder?.record(tx, {
          tenantId: input.tenantId,
          actorKind: input.actorKind,
          actorId: input.actorId,
          eventType: 'PRICE_CREATED',
          resourceType: 'price',
          resourceId: created.id,
          metadata: {
            productId: created.productId,
            channelId: created.channelId,
            currency: created.currency,
            amountMinor: created.amountMinor,
          },
          ...auditRequestFields(),
        });

        return created;
      },
      { tenantId: input.tenantId },
    );

    return { price };
  }
}
