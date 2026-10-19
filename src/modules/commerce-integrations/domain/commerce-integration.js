import { BusinessRuleError } from '../../../shared/errors/index.js';
import { IntegrationStatus } from './integration-status.js';
export class CommerceIntegration {
    id;
    tenantId;
    marketplaceId;
    name;
    externalReference;
    status;
    configurationReference;
    defaultStockLocationId;
    createdAt;
    updatedAt;
    constructor(props) {
        this.id = props.id;
        this.tenantId = props.tenantId;
        this.marketplaceId = props.marketplaceId;
        this.name = props.name;
        this.externalReference = props.externalReference;
        this.status = props.status;
        this.configurationReference = props.configurationReference;
        this.defaultStockLocationId = props.defaultStockLocationId;
        this.createdAt = props.createdAt;
        this.updatedAt = props.updatedAt;
    }
    static create(props) {
        return new CommerceIntegration({
            id: props.id,
            tenantId: props.tenantId,
            marketplaceId: props.marketplaceId,
            name: props.name,
            externalReference: props.externalReference ?? null,
            status: IntegrationStatus.ACTIVE,
            configurationReference: props.configurationReference ?? null,
            defaultStockLocationId: props.defaultStockLocationId ?? null,
            createdAt: props.createdAt,
            updatedAt: props.createdAt,
        });
    }
    static reconstitute(props) {
        return new CommerceIntegration(props);
    }
    isUsable() {
        return this.status === IntegrationStatus.ACTIVE;
    }
    updateDetails(input, at) {
        return new CommerceIntegration({
            id: this.id,
            tenantId: this.tenantId,
            marketplaceId: this.marketplaceId,
            name: input.name ?? this.name,
            externalReference: input.externalReference === undefined ? this.externalReference : input.externalReference,
            status: this.status,
            configurationReference: input.configurationReference === undefined
                ? this.configurationReference
                : input.configurationReference,
            defaultStockLocationId: input.defaultStockLocationId === undefined
                ? this.defaultStockLocationId
                : input.defaultStockLocationId,
            createdAt: this.createdAt,
            updatedAt: at,
        });
    }
    activate(at) {
        if (this.status === IntegrationStatus.ACTIVE) {
            throw new BusinessRuleError('Channel is already active');
        }
        return this.withStatus(IntegrationStatus.ACTIVE, at);
    }
    deactivate(at) {
        if (this.status === IntegrationStatus.INACTIVE) {
            throw new BusinessRuleError('Channel is already inactive');
        }
        return this.withStatus(IntegrationStatus.INACTIVE, at);
    }
    suspend(at) {
        if (this.status === IntegrationStatus.SUSPENDED) {
            throw new BusinessRuleError('Channel is already suspended');
        }
        return this.withStatus(IntegrationStatus.SUSPENDED, at);
    }
    withStatus(status, updatedAt) {
        return new CommerceIntegration({
            id: this.id,
            tenantId: this.tenantId,
            marketplaceId: this.marketplaceId,
            name: this.name,
            externalReference: this.externalReference,
            status,
            configurationReference: this.configurationReference,
            defaultStockLocationId: this.defaultStockLocationId,
            createdAt: this.createdAt,
            updatedAt,
        });
    }
}
