import { ConflictError, NotFoundError } from '../../../shared/errors/index.js';
import {
    fingerprintAcknowledgeReturnCommand,
    fingerprintProcessReturnReceiveCommand,
    fingerprintReturnCommand,
    mapExternalReturnAcknowledgeRequest,
    mapExternalReturnLinesToOrderLines,
    mapExternalReturnReceiveRequest,
    mapExternalReturnRequest,
    mapReturnMutationResultToExternalResponse,
    mapReturnResultToExternalResponse,
    returnMatchesReceiveRequest,
} from './mappers/compatibility-return.mapper.js';

const CREATE_RETURN_ROUTE_ID = 'POST /api/v2/returns';
const ACKNOWLEDGE_RETURN_ROUTE_ID = 'POST /api/v2/returns/merchant/acknowledge';
const RECEIVE_RETURN_ROUTE_ID = 'PUT /api/v2/returns';

export class ReturnCompatibilityCommand {
    deps;

    /**
     * @param {object} deps
     * @param {import('../../orders/public/order-query-service.js').DefaultOrderQueryService} deps.orderQueryService
     * @param {import('../../returns/public/return-query-service.js').DefaultReturnQueryService} deps.returnQueryService
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
    async acknowledgeReturn(input) {
        const mapped = mapExternalReturnAcknowledgeRequest(input.body);
        const returnDetail = await this.deps.returnQueryService.findReturnByExternalReference(
            input.tenantId,
            mapped.merchantReturnNo,
        );
        await this.deps.returnCommandService.acknowledgeReturn({
            tenantId: input.tenantId,
            actorId: input.actorId,
            actorKind: input.actorKind,
            actorPermissions: input.actorPermissions,
            returnId: returnDetail.id,
            idempotencyKey: input.idempotencyKey,
            principalFingerprint: input.principalFingerprint,
            requestFingerprint: fingerprintAcknowledgeReturnCommand(mapped),
            routeId: ACKNOWLEDGE_RETURN_ROUTE_ID,
        });
        return mapReturnMutationResultToExternalResponse({});
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
    async receiveReturn(input) {
        const mapped = mapExternalReturnReceiveRequest(input.body);
        const returnId = await this.resolveReturnForReceive(input.tenantId, input.actorPermissions, mapped.lineDecisions);
        await this.deps.returnCommandService.processReturnReceive({
            tenantId: input.tenantId,
            actorId: input.actorId,
            actorKind: input.actorKind,
            actorPermissions: input.actorPermissions,
            returnId,
            lineDecisions: mapped.lineDecisions,
            idempotencyKey: input.idempotencyKey,
            principalFingerprint: input.principalFingerprint,
            requestFingerprint: fingerprintProcessReturnReceiveCommand(mapped),
            routeId: RECEIVE_RETURN_ROUTE_ID,
        });
        return mapReturnMutationResultToExternalResponse({});
    }

    /**
     * @param {string} tenantId
     * @param {readonly string[]} actorPermissions
     * @param {Array<{ merchantProductNo: string, acceptedQuantity: number, rejectedQuantity: number }>} lineDecisions
     */
    async resolveReturnForReceive(tenantId, actorPermissions, lineDecisions) {
        const page = await this.deps.returnQueryService.listReturns({
            tenantId,
            actorPermissions,
            statuses: ['REQUESTED', 'APPROVED'],
            page: 1,
            pageSize: 100,
        });
        const candidates = [];
        for (const returnEntity of page.items) {
            const orderLines = await this.deps.orderQueryService.getOrderLines(tenantId, returnEntity.orderId);
            if (returnMatchesReceiveRequest(returnEntity, orderLines, lineDecisions)) {
                candidates.push(returnEntity);
            }
        }
        if (candidates.length === 0) {
            throw new NotFoundError('Return was not found', { tenantId });
        }
        if (candidates.length > 1) {
            throw new ConflictError('Return request matches multiple returns', { tenantId });
        }
        return candidates[0].id;
    }
}
