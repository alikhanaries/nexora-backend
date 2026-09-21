import { BusinessRuleError } from '../../../shared/errors/index.js';
import { MarketplaceStatus } from './marketplace-status.js';

export interface MarketplaceProps {
  readonly id: string;
  readonly key: string;
  readonly name: string;
  readonly status: MarketplaceStatus;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}

export interface NewMarketplaceProps {
  readonly id: string;
  readonly key: string;
  readonly name: string;
  readonly createdAt: Date;
}

export class Marketplace {
  readonly id: string;
  readonly key: string;
  readonly name: string;
  readonly status: MarketplaceStatus;
  readonly createdAt: Date;
  readonly updatedAt: Date;

  private constructor(props: MarketplaceProps) {
    this.id = props.id;
    this.key = props.key;
    this.name = props.name;
    this.status = props.status;
    this.createdAt = props.createdAt;
    this.updatedAt = props.updatedAt;
  }

  static create(props: NewMarketplaceProps): Marketplace {
    return new Marketplace({
      id: props.id,
      key: props.key,
      name: props.name,
      status: MarketplaceStatus.ACTIVE,
      createdAt: props.createdAt,
      updatedAt: props.createdAt,
    });
  }

  static reconstitute(props: MarketplaceProps): Marketplace {
    return new Marketplace(props);
  }

  updateName(name: string, at: Date): Marketplace {
    return new Marketplace({
      id: this.id,
      key: this.key,
      name,
      status: this.status,
      createdAt: this.createdAt,
      updatedAt: at,
    });
  }

  activate(at: Date): Marketplace {
    if (this.status === MarketplaceStatus.ACTIVE) {
      throw new BusinessRuleError('Marketplace is already active');
    }
    return this.withStatus(MarketplaceStatus.ACTIVE, at);
  }

  deactivate(at: Date): Marketplace {
    if (this.status === MarketplaceStatus.INACTIVE) {
      throw new BusinessRuleError('Marketplace is already inactive');
    }
    return this.withStatus(MarketplaceStatus.INACTIVE, at);
  }

  private withStatus(status: MarketplaceStatus, updatedAt: Date): Marketplace {
    return new Marketplace({
      id: this.id,
      key: this.key,
      name: this.name,
      status,
      createdAt: this.createdAt,
      updatedAt,
    });
  }
}
