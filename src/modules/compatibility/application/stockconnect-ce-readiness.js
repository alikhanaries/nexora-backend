/**
 * Readiness probe ensuring StockConnect CE compatibility handlers are wired at the composition root.
 * Does not call StockConnect or external CE dependencies.
 *
 * @param {object|null|undefined} routeDeps
 */
export function assertStockConnectCeCompatibilityWired(routeDeps) {
    if (routeDeps === null || routeDeps === undefined) {
        throw new Error('StockConnect CE compatibility route dependencies are missing');
    }
    const required = [
        'stockConnectCeOrderCompatibilityQuery',
        'stockConnectCeCatalogCommand',
        'stockConnectCeOrderInvoiceQuery',
        'stockConnectCeChannelCompatibilityQuery',
    ];
    for (const key of required) {
        if (routeDeps[key] === undefined || routeDeps[key] === null) {
            throw new Error(`StockConnect CE compatibility handler "${key}" is not wired`);
        }
    }
}

/**
 * @param {object|null|undefined} routeDeps
 * @returns {{ name: string, check: () => Promise<void> }}
 */
export function createStockConnectCeCompatibilityReadinessProbe(routeDeps) {
    return {
        name: 'stockconnect_ce_compat',
        check: async () => {
            assertStockConnectCeCompatibilityWired(routeDeps);
        },
    };
}
