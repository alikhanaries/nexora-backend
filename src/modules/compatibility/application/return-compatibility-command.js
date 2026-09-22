import { NotFoundError } from '../../../shared/errors/index.js';
import {
    fingerprintReturnCommand,
    mapExternalReturnLinesToOrderLines,
    mapExternalReturnRequest,
    mapReturnResultToExternalResponse,
} from './mappers/compatibility-return.mapper.js';

const CREATE_RETURN_ROUTE_ID = 'POST /api/v2/returns';

export class ReturnCompatibilityCommand {
    deps;

    /**
     * @param {object} deps
     * @param {import('../../orders/public/order-query-service.js').DefaultOrderQueryService} deps.orderQueryService
     * @param {import('../../returns/public/return-command-service.js').DefaultReturnCommandService} deps.returnCommandService
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
    async createReturn(input) {
        const mapped = mapExternalReturnRequest(input.body);
        const order = await this.deps.orderQueryService.findOrderByOrderNumber(input.tenantId, mapped.orderNumber);
        if (order === null) {
            throw new NotFoundError('Order was not found', {
                tenantId: input.tenantId,
                orderNumber: mapped.orderNumber,
            });
        }
        const orderLines = await this.deps.orderQueryService.getOrderLines(input.tenantId, order.id);
        const lines = mapExternalReturnLinesToOrderLines(mapped.externalLines, orderLines);
        const commandInput = {
            orderNumber: mapped.orderNumber,
            merchantReturnNo: mapped.merchantReturnNo,
            lines,
            reason: mapped.reason,
        };
        const { return: returnDetail } = await this.deps.returnCommandService.createReturn({
            tenantId: input.tenantId,
            actorId: input.actorId,
            actorKind: input.actorKind,
            actorPermissions: input.actorPermissions,
            orderId: order.id,
            lines,
            reason: mapped.reason,
            externalReference: mapped.merchantReturnNo,
            idempotencyKey: input.idempotencyKey,
            principalFingerprint: input.principalFingerprint,
            requestFingerprint: fingerprintReturnCommand(commandInput),
            routeId: CREATE_RETURN_ROUTE_ID,
        });
        return mapReturnResultToExternalResponse({ return: returnDetail });
    }
}
