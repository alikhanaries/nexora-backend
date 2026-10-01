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
import { acknowledgeOrderBodySchema } from '../../modules/compatibility/presentation/compatibility-acknowledge.schemas.js';
import { parseOrThrow } from '../../shared/validation/index.js';
import { CompatibilityExceptionFilter } from '../common/filters/compatibility-exception.filter.js';
import { LegacyOrdersService } from './legacy-orders.service.js';

const stockConnectCeOrdersQuerySchema = z.object({
  page: z.coerce.number().int().min(1).optional(),
  pageSize: z.coerce.number().int().min(1).max(100).optional(),
  apiKey: z.string().optional(),
  apikey: z.string().optional(),
});

const merchantOrderNoParamsSchema = z.object({
  merchantOrderNo: z.string().min(1).max(250),
});

export @Controller()
@UseFilters(CompatibilityExceptionFilter)
class ChannelEngineOrdersController {
  constructor(@Inject(LegacyOrdersService) legacyOrdersService) {
    this.legacyOrdersService = legacyOrdersService;
  }

  @Get('/api/v2/ce/orders/:merchantOrderNo/invoice')
  async downloadInvoice(@Param() params, @Res() res) {
    const { merchantOrderNo } = parseOrThrow(
      merchantOrderNoParamsSchema,
      params,
      'merchant order number',
    );
    const invoice = await this.legacyOrdersService.getCeOrderInvoice(merchantOrderNo);
    res.setHeader('content-type', invoice.contentType);
    res.setHeader(
      'content-disposition',
      `inline; filename="invoice-${merchantOrderNo}.pdf"`,
    );
    res.status(200).send(invoice.body);
  }

  @Get('/api/v2/ce/orders')
  async list(@Query() query) {
    const parsed = stockConnectCeOrdersQuerySchema.parse(query);
    return this.legacyOrdersService.listCeOrders({
      page: parsed.page,
      pageSize: parsed.pageSize,
    });
  }

  @Post('/api/v2/ce/orders/acknowledge')
  @HttpCode(201)
  async acknowledge(@Body() body, @Headers('idempotency-key') idempotencyKey) {
    const parsed = parseOrThrow(acknowledgeOrderBodySchema, body, 'acknowledge order');
    return this.legacyOrdersService.acknowledgeOrderCe(parsed, idempotencyKey);
  }
}
