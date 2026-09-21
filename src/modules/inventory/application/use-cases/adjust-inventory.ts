import type { AuthorizationService } from '../../../authorization/public/index.js';
import { optionalReferenceFields } from '../optional-fields.js';
import type { InventoryService } from '../../public/inventory-service.js';

export interface AdjustInventoryInput {
  readonly tenantId: string;
  readonly actorPermissions: readonly string[];
  readonly stockLocationId: string;
  readonly productId: string;
  readonly delta: number;
  readonly referenceType?: string;
  readonly referenceId?: string;
  readonly idempotencyKey?: string;
  readonly metadata?: Readonly<Record<string, unknown>>;
}

export interface AdjustInventoryDeps {
  readonly inventoryService: InventoryService;
  readonly authorization: AuthorizationService;
}

export class AdjustInventory {
  constructor(private readonly deps: AdjustInventoryDeps) {}

  async execute(input: AdjustInventoryInput) {
    this.deps.authorization.requirePermission(input.actorPermissions, 'inventory.adjust');

    return this.deps.inventoryService.adjust({
      tenantId: input.tenantId,
      stockLocationId: input.stockLocationId,
      productId: input.productId,
      delta: input.delta,
      ...optionalReferenceFields(input),
    });
  }
}
