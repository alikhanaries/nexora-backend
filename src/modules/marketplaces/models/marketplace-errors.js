/** @typedef {import('./marketplace-capabilities.js').MarketplaceCatalogCapabilities} MarketplaceCatalogCapabilities */

export class MarketplaceError extends Error {
    /** @param {string} message */
    constructor(message) {
        super(message);
        this.name = 'MarketplaceError';
    }
}

export class MarketplaceAuthenticationError extends MarketplaceError {
    /** Adapter authentication or token exchange failed. */
    constructor(message = 'Marketplace authentication failed') {
        super(message);
        this.name = 'MarketplaceAuthenticationError';
    }
}

export class MarketplaceRateLimitError extends MarketplaceError {
    /** @type {number | null} */
    retryAfterSeconds;

    /**
     * @param {string} [message]
     * @param {{ retryAfterSeconds?: number | null }} [options]
     */
    constructor(message = 'Marketplace rate limit exceeded', options = {}) {
        super(message);
        this.name = 'MarketplaceRateLimitError';
        this.retryAfterSeconds = options.retryAfterSeconds ?? null;
    }
}

export class MarketplaceTransientError extends MarketplaceError {
    /** @type {number | null} */
    retryDelayMs;

    /**
     * @param {string} [message]
     * @param {{ retryDelayMs?: number | null }} [options]
     */
    constructor(message = 'Transient marketplace error', options = {}) {
        super(message);
        this.name = 'MarketplaceTransientError';
        this.retryDelayMs = options.retryDelayMs ?? null;
    }
}

export class MarketplaceValidationError extends MarketplaceError {
    /** Remote marketplace rejected request payload semantics. */
    constructor(message = 'Marketplace rejected the request') {
        super(message);
        this.name = 'MarketplaceValidationError';
    }
}

export class MarketplaceNotFoundError extends MarketplaceError {
    /** Remote entity (order, SKU, listing) was not found at the marketplace. */
    constructor(message = 'Marketplace resource was not found') {
        super(message);
        this.name = 'MarketplaceNotFoundError';
    }
}

export class MarketplaceConflictError extends MarketplaceError {
    /** Remote state conflict (duplicate create, stale version). */
    constructor(message = 'Marketplace resource conflict') {
        super(message);
        this.name = 'MarketplaceConflictError';
    }
}

export class MarketplaceUnsupportedError extends MarketplaceError {
    /** Capability or operation not implemented for this marketplace adapter. */
    constructor(message = 'Marketplace operation is not supported') {
        super(message);
        this.name = 'MarketplaceUnsupportedError';
    }
}

export class MarketplaceConfigurationError extends MarketplaceError {
    /** Tenant connection missing secrets or marketplace identifiers required by adapter. */
    constructor(message = 'Marketplace connection is not configured') {
        super(message);
        this.name = 'MarketplaceConfigurationError';
    }
}
