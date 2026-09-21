import { randomUUID } from 'node:crypto';
import type { AuditRecorder } from '../../../audit/public/index.js';
import { auditRequestFields } from '../../../audit/public/index.js';
import type { AuthorizationService } from '../../../authorization/public/index.js';
import { ValidationError } from '../../../../shared/errors/index.js';
import type { TransactionManager } from '../../../../shared/persistence/index.js';
import { StockLocation } from '../../domain/stock-location.js';
import type { StockLocationRepository } from '../ports/stock-location-repository.js';

export interface CreateStockLocationInput {
  readonly tenantId: string;
  readonly actorId?: string;
  readonly actorPermissions: readonly string[];
  readonly name: string;
  readonly externalReference?: string | null;
}

export interface CreateStockLocationResult {
  readonly location: StockLocation;
}

export interface CreateStockLocationDeps {
  readonly transactionManager: TransactionManager;
  readonly stockLocations: StockLocationRepository;
  readonly authorization: AuthorizationService;
  readonly auditRecorder?: AuditRecorder;
}

export class CreateStockLocation {
  constructor(private readonly deps: CreateStockLocationDeps) {}

  async execute(input: CreateStockLocationInput): Promise<CreateStockLocationResult> {
    this.deps.authorization.requirePermission(input.actorPermissions, 'inventory.adjust');

    const name = input.name.trim();
    if (name.length === 0) {
      throw new ValidationError('Stock location name is required');
    }

    const now = new Date();
    const location = StockLocation.create({
      id: randomUUID(),
      tenantId: input.tenantId,
      name,
      ...(input.externalReference === undefined
        ? {}
        : { externalReference: input.externalReference }),
      createdAt: now,
    });

    await this.deps.transactionManager.execute(
      async (tx) => {
        await this.deps.stockLocations.insert(tx, location);

        if (this.deps.auditRecorder !== undefined) {
          await this.deps.auditRecorder.record(tx, {
            tenantId: input.tenantId,
            actorKind: input.actorId === undefined ? 'system' : 'user',
            ...(input.actorId === undefined ? {} : { actorId: input.actorId }),
            eventType: 'STOCK_LOCATION_CREATED',
            resourceType: 'stock_location',
            resourceId: location.id,
            metadata: {
              name: location.name,
              externalReference: location.externalReference,
            },
            ...auditRequestFields(),
          });
        }
      },
      { tenantId: input.tenantId },
    );

    return { location };
  }
}
