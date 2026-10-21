import { BusinessRuleError } from '../../../shared/errors/index.js';
import { MarketplaceStatus } from './marketplace-status.js';
export class Marketplace {
    id;
    key;
    name;
    status;
    createdAt;
    updatedAt;
    /**
     * Hydrates immutable marketplace aggregate fields.
     */
    constructor(props) {
        this.id = props.id;
        this.key = props.key;
        this.name = props.name;
        this.status = props.status;
        this.createdAt = props.createdAt;
        this.updatedAt = props.updatedAt;
    }
    /**
     * Factory for new ACTIVE marketplace aggregate.
     */
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
    /**
     * Rebuilds aggregate from persistence without changing invariants.
     */
    static reconstitute(props) {
        return new Marketplace(props);
    }
    /**
     * Returns copy with new display name and updated timestamp.
     */
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
    /**
     * Immutable status transition; throws when already in target status.
     */
    activate(at) {
        if (this.status === MarketplaceStatus.ACTIVE) {
            throw new BusinessRuleError('Marketplace is already active');
        }
        return this.withStatus(MarketplaceStatus.ACTIVE, at);
    }
    /**
     * Immutable status transition; throws when already in target status.
     */
    deactivate(at) {
        if (this.status === MarketplaceStatus.INACTIVE) {
            throw new BusinessRuleError('Marketplace is already inactive');
        }
        return this.withStatus(MarketplaceStatus.INACTIVE, at);
    }
    /**
     * Internal helper copying aggregate with new status.
     */
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
