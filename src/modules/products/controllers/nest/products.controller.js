import {
  Body,
  Controller,
  Get,
  HttpCode,
  Inject,
  Param,
  Patch,
  Post,
  Put,
  Query,
} from '@nestjs/common';
import {
  createProductBodySchema,
  listProductsQuerySchema,
  productIdParamsSchema,
  productLocaleParamsSchema,
  updateProductBodySchema,
  upsertProductContentBodySchema,
} from '../../views/product.schemas.js';
import { toProductContentResponse, toProductResponse } from '../../views/product.mapper.js';
import { parseOrThrow } from '../../../../shared/validation/index.js';
import { requireActorContext } from '../../../../shared/context/require-principal.js';
import { productActorFields } from '../../../../app/common/commerce-actor.js';
import { CORE_SERVICES } from '../../../../app/di/core-services.tokens.js';
import { PRODUCT_ROUTES } from '../../routes/product.routes.js';

/**
 * Thin Nest HTTP adapter — API methods only.
 * Business rules live in services/; paths live in routes/.
 * Route family `/api/v1/products` (PRODUCT_ROUTES); handlers call `CORE_SERVICES.products.useCases`.
 */
@Controller()
class ProductsController {
/** Binds `CORE_SERVICES` product use cases for this HTTP adapter. */
  constructor(@Inject(CORE_SERVICES) coreServices) {
    this.useCases = coreServices.products.useCases;
  }

/** HTTP handler: validates input, reads tenant actor, delegates to product use case `list`. */
  @Get(PRODUCT_ROUTES.list.path)
  async list(@Query() query) {
    const parsed = parseOrThrow(listProductsQuerySchema, query, 'list query');
    const actor = requireActorContext();
    const page = await this.useCases.listProducts.execute({
      tenantId: actor.tenantId,
      actorPermissions: actor.permissions,
      ...(parsed.limit === undefined ? {} : { limit: parsed.limit }),
      ...(parsed.cursor === undefined ? {} : { cursor: parsed.cursor }),
      ...(parsed.status === undefined ? {} : { status: parsed.status }),
    });
    return {
      success: true,
      data: {
        items: page.items.map(toProductResponse),
        nextCursor: page.nextCursor,
        hasMore: page.hasMore,
      },
    };
  }

/** HTTP handler: validates input, reads tenant actor, delegates to product use case `create`. */
  @Post(PRODUCT_ROUTES.create.path)
  @HttpCode(201)
  async create(@Body() body) {
    const parsed = parseOrThrow(createProductBodySchema, body, 'create product');
    const actor = requireActorContext();
    const { actorId, actorKind } = productActorFields(actor);
    const { product } = await this.useCases.createProduct.execute({
      tenantId: actor.tenantId,
      actorId,
      actorKind,
      actorPermissions: actor.permissions,
      merchantSku: parsed.merchantSku,
      ...(parsed.externalReference === undefined ? {} : { externalReference: parsed.externalReference }),
      ...(parsed.productType === undefined ? {} : { productType: parsed.productType }),
    });
    return { success: true, data: toProductResponse(product) };
  }

/** HTTP handler: validates input, reads tenant actor, delegates to product use case `getById`. */
  @Get(PRODUCT_ROUTES.getById.path)
  async getById(@Param() params) {
    const { productId } = parseOrThrow(productIdParamsSchema, params, 'product params');
    const actor = requireActorContext();
    const { product } = await this.useCases.getProduct.execute({
      tenantId: actor.tenantId,
      actorPermissions: actor.permissions,
      productId,
    });
    return { success: true, data: toProductResponse(product) };
  }

/** HTTP handler: validates input, reads tenant actor, delegates to product use case `update`. */
  @Patch(PRODUCT_ROUTES.update.path)
  @HttpCode(200)
  async update(@Param() params, @Body() body) {
    const { productId } = parseOrThrow(productIdParamsSchema, params, 'product params');
    const parsed = parseOrThrow(updateProductBodySchema, body, 'update product');
    const actor = requireActorContext();
    const { actorId, actorKind } = productActorFields(actor);
    const { product } = await this.useCases.updateProduct.execute({
      tenantId: actor.tenantId,
      actorId,
      actorKind,
      actorPermissions: actor.permissions,
      productId,
      ...(parsed.externalReference === undefined ? {} : { externalReference: parsed.externalReference }),
      ...(parsed.productType === undefined ? {} : { productType: parsed.productType }),
    });
    return { success: true, data: toProductResponse(product) };
  }

/** HTTP handler: validates input, reads tenant actor, delegates to product use case `deactivate`. */
  @Post(PRODUCT_ROUTES.deactivate.path)
  @HttpCode(200)
  async deactivate(@Param() params) {
    const { productId } = parseOrThrow(productIdParamsSchema, params, 'product params');
    const actor = requireActorContext();
    const { actorId, actorKind } = productActorFields(actor);
    const { product } = await this.useCases.deactivateProduct.execute({
      tenantId: actor.tenantId,
      actorId,
      actorKind,
      actorPermissions: actor.permissions,
      productId,
    });
    return { success: true, data: toProductResponse(product) };
  }

/** HTTP handler: validates input, reads tenant actor, delegates to product use case `archive`. */
  @Post(PRODUCT_ROUTES.archive.path)
  @HttpCode(200)
  async archive(@Param() params) {
    const { productId } = parseOrThrow(productIdParamsSchema, params, 'product params');
    const actor = requireActorContext();
    const { actorId, actorKind } = productActorFields(actor);
    const { product } = await this.useCases.archiveProduct.execute({
      tenantId: actor.tenantId,
      actorId,
      actorKind,
      actorPermissions: actor.permissions,
      productId,
    });
    return { success: true, data: toProductResponse(product) };
  }

/** HTTP handler: validates input, reads tenant actor, delegates to product use case `listContent`. */
  @Get(PRODUCT_ROUTES.listContent.path)
  async listContent(@Param() params) {
    const { productId } = parseOrThrow(productIdParamsSchema, params, 'product params');
    const actor = requireActorContext();
    const { content } = await this.useCases.getProductContent.execute({
      tenantId: actor.tenantId,
      actorPermissions: actor.permissions,
      productId,
    });
    return { success: true, data: content.map(toProductContentResponse) };
  }

/** HTTP handler: validates input, reads tenant actor, delegates to product use case `upsertContent`. */
  @Put(PRODUCT_ROUTES.upsertContent.path)
  @HttpCode(200)
  async upsertContent(@Param() params, @Body() body) {
    const parsedParams = parseOrThrow(productLocaleParamsSchema, params, 'product locale params');
    const parsedBody = parseOrThrow(upsertProductContentBodySchema, body, 'upsert product content');
    const actor = requireActorContext();
    const { actorId, actorKind } = productActorFields(actor);
    const { content } = await this.useCases.upsertProductContent.execute({
      tenantId: actor.tenantId,
      actorId,
      actorKind,
      actorPermissions: actor.permissions,
      productId: parsedParams.productId,
      locale: parsedParams.locale,
      ...(parsedBody.title === undefined ? {} : { title: parsedBody.title }),
      ...(parsedBody.description === undefined ? {} : { description: parsedBody.description }),
      ...(parsedBody.brand === undefined ? {} : { brand: parsedBody.brand }),
      ...(parsedBody.attributes === undefined ? {} : { attributes: parsedBody.attributes }),
    });
    return { success: true, data: toProductContentResponse(content) };
  }
}
export { ProductsController };
