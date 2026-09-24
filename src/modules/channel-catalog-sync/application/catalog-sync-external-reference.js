/**
 * @param {string|null|undefined} externalReference
 * @returns {string|null}
 */
export function normalizeExternalCatalogReference(externalReference) {
    if (externalReference === null || externalReference === undefined) {
        return null;
    }
    const normalized = String(externalReference).trim();
    return normalized.length > 0 ? normalized : null;
}
