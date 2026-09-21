import type { AuthorizationService } from '../../../authorization/public/index.js';
import { optionalReferenceFields } from '../optional-fields.js';
import type { InventoryService } from '../../public/inventory-service.js';

export interface ReleaseInventoryInput {
  readonly tenantId: string;
  readonly actorPermissions: readonly string[];
  readonly stockLocationId: string;
  readonly productId: string;
  readonly referenceType: string;
  readonly referenceId: string;
  readonly quantity?: number;
  readonly idempotencyKey?: string;
}

export interface ReleaseInventoryDeps {
  readonly inventoryService: InventoryService;
  readonly authorization: AuthorizationService;
}

export class ReleaseInventory {
  constructor(private readonly deps: ReleaseInventoryDeps) {}

  async execute(input: ReleaseInventoryInput) {
    this.deps.authorization.requirePermission(input.actorPermissions, 'inventory.reserve');

    return this.deps.inventoryService.release({
      tenantId: input.tenantId,
      stockLocationId: input.stockLocationId,
      productId: input.productId,
      referenceType: input.referenceType,
      referenceId: input.referenceId,
      ...(input.quantity === undefined ? {} : { quantity: input.quantity }),
      ...optionalReferenceFields({ idempotencyKey: input.idempotencyKey }),
    });
  }
}
