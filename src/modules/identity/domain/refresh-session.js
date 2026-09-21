export class RefreshSession {
    id;
    userId;
    tenantId;
    tokenHash;
    familyId;
    status;
    expiresAt;
    createdAt;
    lastUsedAt;
    revokedAt;
    replacedBy;
    constructor(props) {
        this.id = props.id;
        this.userId = props.userId;
        this.tenantId = props.tenantId;
        this.tokenHash = props.tokenHash;
        this.familyId = props.familyId;
        this.status = props.status;
        this.expiresAt = props.expiresAt;
        this.createdAt = props.createdAt;
        this.lastUsedAt = props.lastUsedAt;
        this.revokedAt = props.revokedAt;
        this.replacedBy = props.replacedBy;
    }
    static create(props) {
        return new RefreshSession(props);
    }
    isExpired(now = new Date()) {
        return now >= this.expiresAt;
    }
    isUsable(now = new Date()) {
        return this.status === 'ACTIVE' && !this.isExpired(now);
    }
    indicatesFamilyReuse() {
        return this.status === 'REPLACED' || this.status === 'REVOKED';
    }
}
