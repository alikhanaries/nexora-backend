import { NotFoundError, ValidationError } from '../../../shared/errors/index.js';
import {
    ExternalIdMappingResourceType,
} from '../../external-id-mapping/public/index.js';
import {
    resolveExternalIntegerId,
    resolveExternalOrderLines,
    resolveReturnForCompatibility,
} from './compatibility-external-id-resolution.js';
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
     * @param {import('../../external-id-mapping/public/external-integer-id-mapping-query-service.js').ExternalIntegerIdMappingQueryService} deps.externalIntegerIdMappingQueryService
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
        const resolvedExternalLines = await resolveExternalOrderLines(
            this.deps.externalIntegerIdMappingQueryService,
            input.tenantId,
            mapped.externalLines,
            orderLines,
        );
        const lines = mapExternalReturnLinesToOrderLines(resolvedExternalLines, orderLines);
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
        const returnDetail = await resolveReturnForCompatibility(
            this.deps.externalIntegerIdMappingQueryService,
            input.tenantId,
            mapped.externalReturnId,
            mapped.merchantReturnNo,
            this.deps.returnQueryService,
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
        const returnId = await resolveExternalIntegerId(
            this.deps.externalIntegerIdMappingQueryService,
            {
                tenantId: input.tenantId,
                resourceType: ExternalIdMappingResourceType.RETURN,
                externalId: mapped.externalReturnId,
                fieldName: 'ReturnId',
            },
        );
        const returnDetail = await this.deps.returnQueryService.getReturnById(input.tenantId, returnId);
        const orderLines = await this.deps.orderQueryService.getOrderLines(input.tenantId, returnDetail.orderId);
        if (!returnMatchesReceiveRequest(returnDetail, orderLines, mapped.lineDecisions)) {
            throw new ValidationError('Return line decisions do not match the resolved return');
        }
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
}
