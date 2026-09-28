import { NotFoundError } from '../../../shared/errors/index.js';
import { generateStockConnectCeInvoicePdf } from './generate-stockconnect-ce-invoice-pdf.js';

/**
 * Resolves order invoice PDF bytes for StockConnect CE `GET orders/{merchantOrderNo}/invoice`.
 */
export class StockConnectCeOrderInvoiceQuery {
    deps;

    /**
     * @param {object} deps
     * @param {import('../../orders/public/order-query-service.js').DefaultOrderQueryService} deps.orderQueryService
     * @param {import('./order-invoice-document.port.js').OrderInvoiceDocumentPort} [deps.orderInvoiceDocumentPort]
     */
    constructor(deps) {
        this.deps = deps;
    }

    /**
     * @param {object} input
     * @param {string} input.tenantId
     * @param {readonly string[]} input.actorPermissions
     * @param {string} input.merchantOrderNo
     * @returns {Promise<{ contentType: string, body: Buffer }>}
     */
    async getOrderInvoice(input) {
        const merchantOrderNo = input.merchantOrderNo.trim();
        if (merchantOrderNo.length === 0) {
            throw new NotFoundError('Order was not found', { merchantOrderNo });
        }
        const page = await this.deps.orderQueryService.listOrders({
            tenantId: input.tenantId,
            actorPermissions: input.actorPermissions,
            orderNumber: merchantOrderNo,
            page: 1,
            pageSize: 1,
        });
        const order = page.items[0];
        if (order === undefined) {
            throw new NotFoundError('Order was not found', { merchantOrderNo, tenantId: input.tenantId });
        }
        if (this.deps.orderInvoiceDocumentPort !== undefined) {
            const fromProvider = await this.deps.orderInvoiceDocumentPort.fetchInvoicePdf({
                tenantId: input.tenantId,
                order,
            });
            if (fromProvider !== null) {
                return fromProvider;
            }
        }
        const body = generateStockConnectCeInvoicePdf({
            merchantOrderNo: order.orderNumber,
            channelOrderNo: order.externalOrderReference ?? undefined,
            orderDate: order.createdAt,
        });
        return {
            contentType: 'application/pdf',
            body,
        };
    }
}
