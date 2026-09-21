import type { AuthorizationService } from '../../../authorization/public/index.js';
import { optionalReferenceFields } from '../optional-fields.js';
import type { InventoryService } from '../../public/inventory-service.js';

export interface ReserveInventoryInput {
  readonly tenantId: string;
  readonly actorPermissions: readonly string[];
  readonly stockLocationId: string;
  readonly productId: string;
  readonly quantity: number;
  readonly referenceType: string;
  readonly referenceId: string;
  readonly idempotencyKey?: string;
}

export interface ReserveInventoryDeps {
  readonly inventoryService: InventoryService;
  readonly authorization: AuthorizationService;
}

export class ReserveInventory {
  constructor(private readonly deps: ReserveInventoryDeps) {}

  async execute(input: ReserveInventoryInput) {
    this.deps.authorization.requirePermission(input.actorPermissions, 'inventory.reserve');

    return this.deps.inventoryService.reserve({
      tenantId: input.tenantId,
      stockLocationId: input.stockLocationId,
      productId: input.productId,
      quantity: input.quantity,
      referenceType: input.referenceType,
      referenceId: input.referenceId,
      ...optionalReferenceFields({ idempotencyKey: input.idempotencyKey }),
    });
  }
}
