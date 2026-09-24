/**
 * @param {string} externalOrderId Shopify GID or numeric legacy id.
 */
export function toShopifyOrderGid(externalOrderId) {
    const trimmed = externalOrderId.trim();
    if (trimmed.startsWith('gid://shopify/Order/')) {
        return trimmed;
    }
    if (/^\d+$/.test(trimmed)) {
        return `gid://shopify/Order/${trimmed}`;
    }
    return trimmed;
}

/**
 * @param {string} gid
 */
export function shopifyOrderGidToExternalId(gid) {
    return gid.trim();
}
