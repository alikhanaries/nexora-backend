import type { AuthorizationService } from '../../../authorization/public/index.js';
import { optionalReferenceFields } from '../optional-fields.js';
import type { InventoryService } from '../../public/inventory-service.js';

export interface ReceiveInventoryInput {
  readonly tenantId: string;
  readonly actorPermissions: readonly string[];
  readonly stockLocationId: string;
  readonly productId: string;
  readonly quantity: number;
  readonly referenceType?: string;
  readonly referenceId?: string;
  readonly idempotencyKey?: string;
  readonly metadata?: Readonly<Record<string, unknown>>;
}

export interface ReceiveInventoryDeps {
  readonly inventoryService: InventoryService;
  readonly authorization: AuthorizationService;
}

export class ReceiveInventory {
  constructor(private readonly deps: ReceiveInventoryDeps) {}

  async execute(input: ReceiveInventoryInput) {
    this.deps.authorization.requirePermission(input.actorPermissions, 'inventory.adjust');

    return this.deps.inventoryService.receive({
      tenantId: input.tenantId,
      stockLocationId: input.stockLocationId,
      productId: input.productId,
      quantity: input.quantity,
      ...optionalReferenceFields(input),
    });
  }
}
