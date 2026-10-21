/**
 * Nest adapter for external compatibility CE order endpoints.
 * Serves `/api/v2/ce/orders*`; handlers delegate to CompatibilityOrdersService (compatibility routeDeps), not domain logic here.
 */
import {
  Body,
  Controller,
  Get,
  Headers,
  HttpCode,
  Inject,
  Param,
  Post,
  Query,
  Res,
  UseFilters,
} from '@nestjs/common';
import { z } from 'zod';
import { acknowledgeOrderBodySchema } from '../../views/compatibility-acknowledge.schemas.js';
import { parseOrThrow } from '../../../../shared/validation/index.js';
import { CompatibilityExceptionFilter } from '../../../../app/common/filters/compatibility-exception.filter.js';
import { CompatibilityOrdersService } from './compatibility-orders.service.js';

const compatV2OrdersQuerySchema = z.object({
  page: z.coerce.number().int().min(1).optional(),
  pageSize: z.coerce.number().int().min(1).max(100).optional(),
  apiKey: z.string().optional(),
  apikey: z.string().optional(),
});

const merchantOrderNoParamsSchema = z.object({
  merchantOrderNo: z.string().min(1).max(250),
});

/** CE order list, invoice download, and acknowledge under `/api/v2/ce/orders*`. */
@Controller()
@UseFilters(CompatibilityExceptionFilter)
class CompatV2OrdersController {
  /** @param {CompatibilityOrdersService} compatibilityOrdersService Order adapter (routeDeps via CORE_SERVICES). */
  constructor(@Inject(CompatibilityOrdersService) compatibilityOrdersService) {
    this.compatibilityOrdersService = compatibilityOrdersService;
  }

  /**
   * GET `/api/v2/ce/orders/:merchantOrderNo/invoice` — streams a generated PDF invoice for one merchant order.
   * Tenant scope comes from the authenticated actor; read rate limit applies before routeDeps lookup.
   * @param {object} params Path params validated to `merchantOrderNo`.
   * @param {import('express').Response} res Express response used to set PDF headers and body.
   * @returns {Promise<void>} Sends 200 with `content-type` PDF; no idempotency or mapping writes.
   */
  @Get('/api/v2/ce/orders/:merchantOrderNo/invoice')
  async downloadInvoice(@Param() params, @Res() res) {
    const { merchantOrderNo } = parseOrThrow(
      merchantOrderNoParamsSchema,
      params,
      'merchant order number',
    );
    const invoice = await this.compatibilityOrdersService.getCeOrderInvoice(merchantOrderNo);
    res.setHeader('content-type', invoice.contentType);
    res.setHeader(
      'content-disposition',
      `inline; filename="invoice-${merchantOrderNo}.pdf"`,
    );
    res.status(200).send(invoice.body);
  }

  /**
   * GET `/api/v2/ce/orders` — paginated order poll for external compatibility CE clients.
   * @param {object} query Optional `page` / `pageSize` (legacy apiKey fields ignored after parse).
   * @returns {Promise<object>} CE-shaped ApiResponse; orders include external integer IDs from mapping service.
   */
  @Get('/api/v2/ce/orders')
  async list(@Query() query) {
    const parsed = parseOrThrow(compatV2OrdersQuerySchema, query, 'query');
    return this.compatibilityOrdersService.listCeOrders({
      page: parsed.page,
      pageSize: parsed.pageSize,
    });
  }

  /**
   * POST `/api/v2/ce/orders/acknowledge` — marks orders acknowledged in merchant compatibility flow.
   * Idempotency key is resolved (header or deterministic CE compat digest) before order command runs.
   * @param {object} body Acknowledge payload (merchant order numbers).
   * @param {string | string[] | undefined} idempotencyKey Optional `Idempotency-Key` header.
   * @returns {Promise<object>} External acknowledge envelope; may replay prior success for same tenant + key.
   */
  @Post('/api/v2/ce/orders/acknowledge')
  @HttpCode(201)
  async acknowledge(@Body() body, @Headers('idempotency-key') idempotencyKey) {
    const parsed = parseOrThrow(acknowledgeOrderBodySchema, body, 'acknowledge order');
    return this.compatibilityOrdersService.acknowledgeOrderCe(parsed, idempotencyKey);
  }
}
export { CompatV2OrdersController };
