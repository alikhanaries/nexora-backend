import type { AuthorizationService } from '../../../authorization/public/index.js';
import type { Queryable } from '../../../../shared/persistence/index.js';
import type { StockLocation } from '../../domain/stock-location.js';
import type { StockLocationRepository } from '../ports/stock-location-repository.js';

export interface ListStockLocationsInput {
  readonly tenantId: string;
  readonly actorPermissions: readonly string[];
}

export interface ListStockLocationsResult {
  readonly locations: readonly StockLocation[];
}

export interface ListStockLocationsDeps {
  readonly queryable: Queryable;
  readonly stockLocations: StockLocationRepository;
  readonly authorization: AuthorizationService;
}

export class ListStockLocations {
  constructor(private readonly deps: ListStockLocationsDeps) {}

  async execute(input: ListStockLocationsInput): Promise<ListStockLocationsResult> {
    this.deps.authorization.requirePermission(input.actorPermissions, 'inventory.read');

    const locations = await this.deps.stockLocations.list(this.deps.queryable, input.tenantId);
    return { locations };
  }
}
