import { BusinessRuleError } from '../../../shared/errors/index.js';
import { ChannelStatus } from './channel-status.js';
export class Channel {
    id;
    tenantId;
    marketplaceId;
    name;
    externalReference;
    status;
    configurationReference;
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
        this.createdAt = props.createdAt;
        this.updatedAt = props.updatedAt;
    }
    static create(props) {
        return new Channel({
            id: props.id,
            tenantId: props.tenantId,
            marketplaceId: props.marketplaceId,
            name: props.name,
            externalReference: props.externalReference ?? null,
            status: ChannelStatus.ACTIVE,
            configurationReference: props.configurationReference ?? null,
            createdAt: props.createdAt,
            updatedAt: props.createdAt,
        });
    }
    static reconstitute(props) {
        return new Channel(props);
    }
    isUsable() {
        return this.status === ChannelStatus.ACTIVE;
    }
    updateDetails(input, at) {
        return new Channel({
            id: this.id,
            tenantId: this.tenantId,
            marketplaceId: this.marketplaceId,
            name: input.name ?? this.name,
            externalReference: input.externalReference === undefined ? this.externalReference : input.externalReference,
            status: this.status,
            configurationReference: input.configurationReference === undefined
                ? this.configurationReference
                : input.configurationReference,
            createdAt: this.createdAt,
            updatedAt: at,
        });
    }
    activate(at) {
        if (this.status === ChannelStatus.ACTIVE) {
            throw new BusinessRuleError('Channel is already active');
        }
        return this.withStatus(ChannelStatus.ACTIVE, at);
    }
    deactivate(at) {
        if (this.status === ChannelStatus.INACTIVE) {
            throw new BusinessRuleError('Channel is already inactive');
        }
        return this.withStatus(ChannelStatus.INACTIVE, at);
    }
    suspend(at) {
        if (this.status === ChannelStatus.SUSPENDED) {
            throw new BusinessRuleError('Channel is already suspended');
        }
        return this.withStatus(ChannelStatus.SUSPENDED, at);
    }
    withStatus(status, updatedAt) {
        return new Channel({
            id: this.id,
            tenantId: this.tenantId,
            marketplaceId: this.marketplaceId,
            name: this.name,
            externalReference: this.externalReference,
            status,
            configurationReference: this.configurationReference,
            createdAt: this.createdAt,
            updatedAt,
        });
    }
}
