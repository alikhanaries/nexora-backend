import { NotFoundError } from '../../../shared/errors/index.js';
import {
    fingerprintCancellationCommand,
    mapExternalCancellationLinesToOrderLines,
    mapExternalCancellationRequest,
    mapCancellationResultToExternalResponse,
} from './mappers/compatibility-cancellation.mapper.js';

const CREATE_CANCELLATION_ROUTE_ID = 'POST /api/v2/cancellations';

export class CancellationCompatibilityCommand {
    deps;

    /**
     * @param {object} deps
     * @param {import('../../orders/public/order-query-service.js').DefaultOrderQueryService} deps.orderQueryService
     * @param {import('../../cancellations/public/cancellation-command-service.js').DefaultCancellationCommandService} deps.cancellationCommandService
     */
    constructor(deps) {
        this.deps = deps;
    }

    /**
     * @param {object} input
     * @param {string} input.tenantId
     * @param {string} input.actorId
     * @param {'user'|'api-key'} input.actorKind
     * @param {readonly string[]} input.actorPermissions
     * @param {object} input.body
     * @param {string} input.idempotencyKey
     * @param {string} input.principalFingerprint
     */
    async createCancellation(input) {
        const mapped = mapExternalCancellationRequest(input.body);
        const order = await this.deps.orderQueryService.findOrderByOrderNumber(input.tenantId, mapped.orderNumber);
        if (order === null) {
            throw new NotFoundError('Order was not found', {
                tenantId: input.tenantId,
                orderNumber: mapped.orderNumber,
            });
        }
        const orderLines = await this.deps.orderQueryService.getOrderLines(input.tenantId, order.id);
        const lines = mapExternalCancellationLinesToOrderLines(mapped.externalLines, orderLines);
        const commandInput = {
            orderNumber: mapped.orderNumber,
            merchantCancellationNo: mapped.merchantCancellationNo,
            lines,
            reason: mapped.reason,
        };
        const { cancellation } = await this.deps.cancellationCommandService.createCancellation({
            tenantId: input.tenantId,
            actorId: input.actorId,
            actorKind: input.actorKind,
            actorPermissions: input.actorPermissions,
            orderId: order.id,
            lines,
            reason: mapped.reason,
            externalReference: mapped.merchantCancellationNo,
            idempotencyKey: input.idempotencyKey,
            principalFingerprint: input.principalFingerprint,
            requestFingerprint: fingerprintCancellationCommand(commandInput),
            routeId: CREATE_CANCELLATION_ROUTE_ID,
        });
        return mapCancellationResultToExternalResponse({ cancellation });
    }
}
