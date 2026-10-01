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
} from '@nestjs/common';
import {
  cancellationIdParamsSchema,
  createCancellationBodySchema,
  listCancellationsQuerySchema,
} from '../../modules/cancellations/presentation/cancellation.schemas.js';
import { parseOrThrow } from '../../shared/validation/index.js';
import { CancellationsService } from './cancellations.service.js';

export @Controller()
class CancellationsController {
  constructor(@Inject(CancellationsService) cancellationsService) {
    this.cancellationsService = cancellationsService;
  }

  @Get('/api/v1/cancellations')
  async list(@Query() query) {
    const parsed = listCancellationsQuerySchema.parse(query);
    const data = await this.cancellationsService.listCancellations(parsed);
    return { success: true, data };
  }

  @Post('/api/v1/cancellations')
  @HttpCode(201)
  async create(@Body() body, @Headers('idempotency-key') idempotencyKey) {
    const parsed = parseOrThrow(createCancellationBodySchema, body, 'create cancellation');
    return this.cancellationsService.createCancellation(parsed, idempotencyKey);
  }

  @Get('/api/v1/cancellations/:cancellationId')
  async getById(@Param() params) {
    const { cancellationId } = parseOrThrow(
      cancellationIdParamsSchema,
      params,
      'cancellation params',
    );
    const data = await this.cancellationsService.getCancellation(cancellationId);
    return { success: true, data };
  }
}
