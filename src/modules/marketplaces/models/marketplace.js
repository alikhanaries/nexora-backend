import { BusinessRuleError } from '../../../shared/errors/index.js';
import { MarketplaceStatus } from './marketplace-status.js';
export class Marketplace {
    id;
    key;
    name;
    status;
    createdAt;
    updatedAt;
    constructor(props) {
        this.id = props.id;
        this.key = props.key;
        this.name = props.name;
        this.status = props.status;
        this.createdAt = props.createdAt;
        this.updatedAt = props.updatedAt;
    }
    static create(props) {
        return new Marketplace({
            id: props.id,
            key: props.key,
            name: props.name,
            status: MarketplaceStatus.ACTIVE,
            createdAt: props.createdAt,
            updatedAt: props.createdAt,
        });
    }
    static reconstitute(props) {
        return new Marketplace(props);
    }
    updateName(name, at) {
        return new Marketplace({
            id: this.id,
            key: this.key,
            name,
            status: this.status,
            createdAt: this.createdAt,
            updatedAt: at,
        });
    }
    activate(at) {
        if (this.status === MarketplaceStatus.ACTIVE) {
            throw new BusinessRuleError('Marketplace is already active');
        }
        return this.withStatus(MarketplaceStatus.ACTIVE, at);
    }
    deactivate(at) {
        if (this.status === MarketplaceStatus.INACTIVE) {
            throw new BusinessRuleError('Marketplace is already inactive');
        }
        return this.withStatus(MarketplaceStatus.INACTIVE, at);
    }
    withStatus(status, updatedAt) {
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
