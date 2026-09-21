import { BusinessRuleError } from '../../../shared/errors/index.js';
import type { StockLocationStatus } from './stock-location-status.js';
import { StockLocationStatus as Status } from './stock-location-status.js';

export interface StockLocationProps {
  readonly id: string;
  readonly tenantId: string;
  readonly name: string;
  readonly externalReference: string | null;
  readonly status: StockLocationStatus;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}

export interface NewStockLocationProps {
  readonly id: string;
  readonly tenantId: string;
  readonly name: string;
  readonly externalReference?: string | null;
  readonly createdAt: Date;
}

export class StockLocation {
  readonly id: string;
  readonly tenantId: string;
  readonly name: string;
  readonly externalReference: string | null;
  readonly status: StockLocationStatus;
  readonly createdAt: Date;
  readonly updatedAt: Date;

  private constructor(props: StockLocationProps) {
    this.id = props.id;
    this.tenantId = props.tenantId;
    this.name = props.name;
    this.externalReference = props.externalReference;
    this.status = props.status;
    this.createdAt = props.createdAt;
    this.updatedAt = props.updatedAt;
  }

  static create(props: NewStockLocationProps): StockLocation {
    const name = props.name.trim();
    if (name.length === 0) {
      throw new BusinessRuleError('Stock location name is required');
    }

    return new StockLocation({
      id: props.id,
      tenantId: props.tenantId,
      name,
      externalReference: props.externalReference?.trim() ?? null,
      status: Status.ACTIVE,
      createdAt: props.createdAt,
      updatedAt: props.createdAt,
    });
  }

  static reconstitute(props: StockLocationProps): StockLocation {
    return new StockLocation(props);
  }

  assertUsable(): void {
    if (this.status !== Status.ACTIVE) {
      throw new BusinessRuleError('Stock location is not active', {
        stockLocationId: this.id,
        status: this.status,
      });
    }
  }
}
