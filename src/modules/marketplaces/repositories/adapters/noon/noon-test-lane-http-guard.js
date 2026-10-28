import { NoonTestLaneHttpBlockedError } from '../../../models/marketplace-errors.js';
import { classifyNoonGatewayUrl } from './noon-gateway-classification.js';

/**
 * When {@link testLaneBlockExternalHttp} is enabled, blocks all outbound HTTP to the
 * production Noon Partners gateway (including GET/login). Opt-in only; default off.
 *
 * @param {boolean} testLaneBlockExternalHttp
 * @param {string} resolvedBaseUrl
 * @param {string | undefined} method
 * @param {string} path
 * @param {import('../../../../../shared/logging/logger.port.js').Logger | undefined} logger
 */
export function assertNoonTestLaneHttpAllowed(
    testLaneBlockExternalHttp,
    resolvedBaseUrl,
    method,
    path,
    logger,
) {
    if (!testLaneBlockExternalHttp) {
        return;
    }
    if (classifyNoonGatewayUrl(resolvedBaseUrl) !== 'production_partners') {
        return;
    }
    logger?.warn({
        method: method ?? 'GET',
        path: path.split('?')[0],
        noonTestLaneBlockExternalHttp: true,
        gatewayClassification: 'production_partners',
    }, 'Noon outbound HTTP blocked by test-lane guard');
    throw new NoonTestLaneHttpBlockedError(path.split('?')[0], method);
}
