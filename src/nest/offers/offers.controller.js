import { Body, Controller, Get, HttpCode, Inject, Param, Patch, Post, Query } from '@nestjs/common';
import {
  activateOfferBodySchema,
  createOfferBodySchema,
  listOffersQuerySchema,
  offerIdParamsSchema,
  updateOfferBodySchema,
} from '../../modules/offers/presentation/offer.schemas.js';
import { parseOrThrow } from '../../shared/validation/index.js';
import { OffersService } from './offers.service.js';

export @Controller()
class OffersController {
  constructor(@Inject(OffersService) offersService) {
    this.offersService = offersService;
  }

  @Get('/api/v1/offers')
  async list(@Query() query) {
    const parsed = listOffersQuerySchema.parse(query);
    const data = await this.offersService.listOffers(parsed);
    return { success: true, data };
  }

  @Post('/api/v1/offers')
  @HttpCode(201)
  async create(@Body() body) {
    const parsed = parseOrThrow(createOfferBodySchema, body, 'create offer');
    const data = await this.offersService.createOffer(parsed);
    return { success: true, data };
  }

  @Get('/api/v1/offers/:offerId')
  async getById(@Param() params) {
    const { offerId } = parseOrThrow(offerIdParamsSchema, params, 'offer params');
    const data = await this.offersService.getOffer(offerId);
    return { success: true, data };
  }

  @Patch('/api/v1/offers/:offerId')
  @HttpCode(200)
  async patch(@Param() params, @Body() body) {
    const { offerId } = parseOrThrow(offerIdParamsSchema, params, 'offer params');
    const parsed = parseOrThrow(updateOfferBodySchema, body, 'update offer');
    const data = await this.offersService.patchOffer(offerId, parsed);
    return { success: true, data };
  }

  @Post('/api/v1/offers/:offerId/activate')
  @HttpCode(200)
  async activate(@Param() params, @Body() body) {
    const { offerId } = parseOrThrow(offerIdParamsSchema, params, 'offer params');
    const parsed = parseOrThrow(activateOfferBodySchema, body ?? {}, 'activate offer');
    const data = await this.offersService.activateOffer(offerId, parsed);
    return { success: true, data };
  }
}
