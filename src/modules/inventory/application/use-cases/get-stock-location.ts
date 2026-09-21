import type { AuthorizationService } from '../../../authorization/public/index.js';
import { NotFoundError } from '../../../../shared/errors/index.js';
import type { Queryable } from '../../../../shared/persistence/index.js';
import type { StockLocation } from '../../domain/stock-location.js';
import type { StockLocationRepository } from '../ports/stock-location-repository.js';

export interface GetStockLocationInput {
  readonly tenantId: string;
  readonly actorPermissions: readonly string[];
  readonly stockLocationId: string;
}

export interface GetStockLocationResult {
  readonly location: StockLocation;
}

export interface GetStockLocationDeps {
  readonly queryable: Queryable;
  readonly stockLocations: StockLocationRepository;
  readonly authorization: AuthorizationService;
}

export class GetStockLocation {
  constructor(private readonly deps: GetStockLocationDeps) {}

  async execute(input: GetStockLocationInput): Promise<GetStockLocationResult> {
    this.deps.authorization.requirePermission(input.actorPermissions, 'inventory.read');

    const location = await this.deps.stockLocations.findById(
      this.deps.queryable,
      input.tenantId,
      input.stockLocationId,
    );

    if (location === null) {
      throw new NotFoundError('Stock location was not found', {
        stockLocationId: input.stockLocationId,
      });
    }

    return { location };
  }
}
