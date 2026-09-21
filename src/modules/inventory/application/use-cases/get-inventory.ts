import type { AuthorizationService } from '../../../authorization/public/index.js';
import type { Queryable } from '../../../../shared/persistence/index.js';
import type { InventoryBalance } from '../../domain/inventory-balance.js';
import type { InventoryRepository } from '../ports/inventory-repository.js';

export interface GetInventoryInput {
  readonly tenantId: string;
  readonly actorPermissions: readonly string[];
  readonly productId?: string;
  readonly stockLocationId?: string;
}

export interface GetInventoryResult {
  readonly balances: readonly InventoryBalance[];
}

export interface GetInventoryDeps {
  readonly queryable: Queryable;
  readonly inventoryRepository: InventoryRepository;
  readonly authorization: AuthorizationService;
}

export class GetInventory {
  constructor(private readonly deps: GetInventoryDeps) {}

  async execute(input: GetInventoryInput): Promise<GetInventoryResult> {
    this.deps.authorization.requirePermission(input.actorPermissions, 'inventory.read');

    const balances = await this.deps.inventoryRepository.listBalances(
      this.deps.queryable,
      input.tenantId,
      {
        ...(input.productId === undefined ? {} : { productId: input.productId }),
        ...(input.stockLocationId === undefined ? {} : { stockLocationId: input.stockLocationId }),
      },
    );

    return { balances };
  }
}
