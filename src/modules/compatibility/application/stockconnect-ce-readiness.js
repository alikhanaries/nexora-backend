/**
 * Verifies external compatibility route handlers (`/api/v2/ce/*`) are wired at the composition root.
 * Does not call external consumers or perform outbound HTTP.
 *
 * @param {object|null|undefined} routeDeps
 */
export function assertExternalCompatibilityCeRoutesWired(routeDeps) {
    if (routeDeps === null || routeDeps === undefined) {
        throw new Error('External compatibility route dependencies are missing');
    }
    const required = [
        'stockConnectCeOrderCompatibilityQuery',
        'stockConnectCeCatalogCommand',
        'stockConnectCeOrderInvoiceQuery',
        'stockConnectCeChannelCompatibilityQuery',
    ];
    for (const key of required) {
        if (routeDeps[key] === undefined || routeDeps[key] === null) {
            throw new Error(`External compatibility handler "${key}" is not wired`);
        }
    }
}

/** @deprecated Use {@link assertExternalCompatibilityCeRoutesWired} */
export const assertStockConnectCeCompatibilityWired = assertExternalCompatibilityCeRoutesWired;

/**
 * @param {object|null|undefined} routeDeps
 * @returns {{ name: string, check: () => Promise<void> }}
 */
export function createExternalCompatibilityReadinessProbe(routeDeps) {
    return {
        name: 'external_compat_ce_routes',
        check: async () => {
            assertExternalCompatibilityCeRoutesWired(routeDeps);
        },
    };
}

/**
 * Legacy probe name retained for existing dashboards and runbooks.
 *
 * @param {object|null|undefined} routeDeps
 * @returns {{ name: string, check: () => Promise<void> }}
 */
export function createStockConnectCeCompatibilityReadinessProbe(routeDeps) {
    return {
        name: 'stockconnect_ce_compat',
        check: async () => {
            assertExternalCompatibilityCeRoutesWired(routeDeps);
        },
    };
}
