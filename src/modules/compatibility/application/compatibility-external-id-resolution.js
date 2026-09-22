import {
    ExternalIdMappingProvider,
    ExternalIdMappingResourceType,
} from '../../external-id-mapping/public/index.js';
import { ConflictError, NotFoundError, ValidationError } from '../../../shared/errors/index.js';

const EXTERNAL_INTEGER_PATTERN = /^-?(?:0|[1-9]\d*)$/;

/**
 * @param {string|number|null|undefined} value
 * @param {string} [fieldName]
 * @returns {number|null}
 */
export function parseExternalIntegerId(value, fieldName = 'External ID') {
    if (value === null || value === undefined) {
        return null;
    }
    const normalized = String(value).trim();
    if (!EXTERNAL_INTEGER_PATTERN.test(normalized)) {
        throw new ValidationError(`${fieldName} must be a positive integer`);
    }
    const parsed = Number(normalized);
    if (!Number.isSafeInteger(parsed) || parsed <= 0) {
        throw new ValidationError(`${fieldName} must be a positive integer`);
    }
    return parsed;
}

/**
 * @param {import('../../external-id-mapping/public/external-integer-id-mapping-query-service.js').ExternalIntegerIdMappingQueryService} queryService
 * @param {{
 *   tenantId: string,
 *   resourceType: string,
 *   externalId: string|number,
 *   fieldName?: string,
 *   tx?: object,
 * }} input
 * @returns {Promise<string>}
 */
export async function resolveExternalIntegerId(queryService, input) {
    const parsedExternalId = parseExternalIntegerId(input.externalId, input.fieldName);
    if (parsedExternalId === null) {
        throw new ValidationError(`${input.fieldName ?? 'External ID'} is required`);
    }
    const resourceId = await queryService.findResourceIdByExternalId(
        input.tenantId,
        ExternalIdMappingProvider.COMPAT_V2,
        input.resourceType,
        parsedExternalId,
        input.tx,
    );
    if (resourceId === null) {
        throw new NotFoundError('External resource was not found', {
            resourceType: input.resourceType,
            externalId: parsedExternalId,
        });
    }
    return resourceId;
}

/**
 * @param {import('../../external-id-mapping/public/external-integer-id-mapping-query-service.js').ExternalIntegerIdMappingQueryService} queryService
 * @param {string} tenantId
 * @param {string|number|null|undefined} externalOrderId
 * @param {string} merchantOrderNo
 * @param {import('../../orders/public/order-query-service.js').DefaultOrderQueryService} orderQueryService
 */
export async function resolveOrderForCompatibility(queryService, tenantId, externalOrderId, merchantOrderNo, orderQueryService) {
    const orderNumber = merchantOrderNo.trim();
    const orderByNumber = await orderQueryService.findOrderByOrderNumber(tenantId, orderNumber);
    if (orderByNumber === null) {
        throw new NotFoundError('Order was not found', { tenantId, orderNumber });
    }
    const parsedExternalOrderId = parseExternalIntegerId(externalOrderId, 'OrderId');
    if (parsedExternalOrderId === null) {
        return orderByNumber;
    }
    const orderIdFromExternal = await resolveExternalIntegerId(queryService, {
        tenantId,
        resourceType: ExternalIdMappingResourceType.ORDER,
        externalId: parsedExternalOrderId,
        fieldName: 'OrderId',
    });
    if (orderIdFromExternal !== orderByNumber.id) {
        throw new ConflictError('OrderId does not match MerchantOrderNo', {
            orderId: parsedExternalOrderId,
            orderNumber,
        });
    }
    return orderByNumber;
}

/**
 * @param {import('../../external-id-mapping/public/external-integer-id-mapping-query-service.js').ExternalIntegerIdMappingQueryService} queryService
 * @param {string} tenantId
 * @param {string|number|null|undefined} externalOrderLineId
 * @param {readonly object[]} orderLines
 * @param {string|undefined} merchantProductNo
 */
export async function resolveOrderLineForCompatibility(
    queryService,
    tenantId,
    externalOrderLineId,
    orderLines,
    merchantProductNo,
) {
    const parsedExternalLineId = parseExternalIntegerId(externalOrderLineId, 'OrderLineId');
    if (parsedExternalLineId === null) {
        return null;
    }
    const orderLineId = await resolveExternalIntegerId(queryService, {
        tenantId,
        resourceType: ExternalIdMappingResourceType.ORDER_LINE,
        externalId: parsedExternalLineId,
        fieldName: 'OrderLineId',
    });
    const orderLine = orderLines.find((line) => line.id === orderLineId);
    if (orderLine === undefined) {
        throw new ConflictError('OrderLineId does not belong to the requested order', {
            orderLineId: parsedExternalLineId,
        });
    }
    if (merchantProductNo !== undefined) {
        const sku = merchantProductNo.trim();
        if (sku.length > 0 && orderLine.merchantSku !== sku) {
            throw new ConflictError('OrderLineId does not match MerchantProductNo', {
                orderLineId: parsedExternalLineId,
                merchantProductNo: sku,
            });
        }
    }
    return orderLineId;
}

/**
 * @param {import('../../external-id-mapping/public/external-integer-id-mapping-query-service.js').ExternalIntegerIdMappingQueryService} queryService
 * @param {string} tenantId
 * @param {readonly object[]} externalLines
 * @param {readonly object[]} orderLines
 */
export async function resolveExternalOrderLines(queryService, tenantId, externalLines, orderLines) {
    return Promise.all(externalLines.map(async (line) => {
        const resolvedOrderLineId = await resolveOrderLineForCompatibility(
            queryService,
            tenantId,
            line.OrderLineId,
            orderLines,
            line.MerchantProductNo,
        );
        return resolvedOrderLineId === null
            ? line
            : { ...line, resolvedOrderLineId };
    }));
}

/**
 * @param {import('../../external-id-mapping/public/external-integer-id-mapping-query-service.js').ExternalIntegerIdMappingQueryService} queryService
 * @param {string} tenantId
 * @param {string|number|null|undefined} externalReturnId
 * @param {string} merchantReturnNo
 * @param {import('../../returns/public/return-query-service.js').DefaultReturnQueryService} returnQueryService
 */
export async function resolveReturnForCompatibility(
    queryService,
    tenantId,
    externalReturnId,
    merchantReturnNo,
    returnQueryService,
) {
    const parsedExternalReturnId = parseExternalIntegerId(externalReturnId, 'ReturnId');
    if (parsedExternalReturnId === null) {
        return returnQueryService.findReturnByExternalReference(tenantId, merchantReturnNo);
    }
    const returnId = await resolveExternalIntegerId(queryService, {
        tenantId,
        resourceType: ExternalIdMappingResourceType.RETURN,
        externalId: parsedExternalReturnId,
        fieldName: 'ReturnId',
    });
    const returnDetail = await returnQueryService.getReturnById(tenantId, returnId);
    if (returnDetail.externalReference !== merchantReturnNo) {
        throw new ConflictError('ReturnId does not match MerchantReturnNo', {
            returnId: parsedExternalReturnId,
            merchantReturnNo,
        });
    }
    return returnDetail;
}
