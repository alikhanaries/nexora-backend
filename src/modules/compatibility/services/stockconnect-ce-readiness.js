/**
 * Legacy readiness probe name `stockconnect_ce_compat` for existing dashboards and runbooks.
 * Delegates to the same `/api/v2/ce/*` wiring check as compat-v2 readiness; does not call
 * external consumers or perform outbound HTTP.
 */
import { assertExternalCompatibilityCeRoutesWired } from './compat-v2-readiness.js';

/** @deprecated Use {@link assertExternalCompatibilityCeRoutesWired} */
export const assertStockConnectCeCompatibilityWired = assertExternalCompatibilityCeRoutesWired;

/**
 * @param {object|null|undefined} routeDeps Compatibility module `routeDeps` from the composition root
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
