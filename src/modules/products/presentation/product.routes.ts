import type { FastifyPluginAsync } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { requireActorContext } from '../../../shared/context/require-principal.js';
import type { ArchiveProduct } from '../application/archive-product.js';
import type { CreateProduct } from '../application/create-product.js';
import type { DeactivateProduct } from '../application/deactivate-product.js';
import type { GetProduct } from '../application/get-product.js';
import type { GetProductContent } from '../application/get-product-content.js';
import type { ListProducts } from '../application/list-products.js';
import type { UpdateProduct } from '../application/update-product.js';
import type { UpsertProductContent } from '../application/upsert-product-content.js';
import { toProductContentResponse, toProductResponse } from './product.mapper.js';
import {
  createProductBodySchema,
  listProductsQuerySchema,
  productContentListSuccessResponseSchema,
  productContentSuccessResponseSchema,
  productIdParamsSchema,
  productListSuccessResponseSchema,
  productLocaleParamsSchema,
  productSuccessResponseSchema,
  updateProductBodySchema,
  upsertProductContentBodySchema,
} from './product.schemas.js';

export interface ProductRoutesDependencies {
  readonly createProduct: CreateProduct;
  readonly getProduct: GetProduct;
  readonly listProducts: ListProducts;
  readonly updateProduct: UpdateProduct;
  readonly deactivateProduct: DeactivateProduct;
  readonly archiveProduct: ArchiveProduct;
  readonly upsertProductContent: UpsertProductContent;
  readonly getProductContent: GetProductContent;
}

function actorFields(actor: ReturnType<typeof requireActorContext>): {
  readonly actorId: string;
  readonly actorKind: 'user' | 'api-key';
} {
  return {
    actorId: actor.userId ?? actor.apiKeyId ?? actor.tenantId,
    actorKind: actor.apiKeyId === undefined ? 'user' : 'api-key',
  };
}

const productRoutes: FastifyPluginAsync<ProductRoutesDependencies> = async (app, deps) => {
  const typed = app.withTypeProvider<ZodTypeProvider>();

  typed.get(
    '/api/v1/products',
    {
      schema: {
        tags: ['Products'],
        summary: 'List products for the current tenant',
        querystring: listProductsQuerySchema,
        response: {
          200: productListSuccessResponseSchema,
        },
      },
    },
    async (request) => {
      const actor = requireActorContext();
      const query = listProductsQuerySchema.parse(request.query);
      const page = await deps.listProducts.execute({
        tenantId: actor.tenantId,
        actorPermissions: actor.permissions,
        ...(query.limit === undefined ? {} : { limit: query.limit }),
        ...(query.cursor === undefined ? {} : { cursor: query.cursor }),
        ...(query.status === undefined ? {} : { status: query.status }),
      });

      return {
        success: true as const,
        data: {
          items: page.items.map(toProductResponse),
          nextCursor: page.nextCursor,
          hasMore: page.hasMore,
        },
      };
    },
  );

  typed.post(
    '/api/v1/products',
    {
      schema: {
        tags: ['Products'],
        summary: 'Create a product',
        body: createProductBodySchema,
        response: {
          201: productSuccessResponseSchema,
        },
      },
    },
    async (request, reply) => {
      const actor = requireActorContext();
      const { actorId, actorKind } = actorFields(actor);
      const { product } = await deps.createProduct.execute({
        tenantId: actor.tenantId,
        actorId,
        actorKind,
        actorPermissions: actor.permissions,
        merchantSku: request.body.merchantSku,
        ...(request.body.externalReference === undefined
          ? {}
          : { externalReference: request.body.externalReference }),
        ...(request.body.productType === undefined
          ? {}
          : { productType: request.body.productType }),
      });

      return reply.status(201).send({
        success: true as const,
        data: toProductResponse(product),
      });
    },
  );

  typed.get(
    '/api/v1/products/:productId',
    {
      schema: {
        tags: ['Products'],
        summary: 'Get a product by id',
        params: productIdParamsSchema,
        response: {
          200: productSuccessResponseSchema,
        },
      },
    },
    async (request) => {
      const actor = requireActorContext();
      const { product } = await deps.getProduct.execute({
        tenantId: actor.tenantId,
        actorPermissions: actor.permissions,
        productId: request.params.productId,
      });

      return {
        success: true as const,
        data: toProductResponse(product),
      };
    },
  );

  typed.patch(
    '/api/v1/products/:productId',
    {
      schema: {
        tags: ['Products'],
        summary: 'Update a product',
        params: productIdParamsSchema,
        body: updateProductBodySchema,
        response: {
          200: productSuccessResponseSchema,
        },
      },
    },
    async (request) => {
      const actor = requireActorContext();
      const { actorId, actorKind } = actorFields(actor);
      const { product } = await deps.updateProduct.execute({
        tenantId: actor.tenantId,
        actorId,
        actorKind,
        actorPermissions: actor.permissions,
        productId: request.params.productId,
        ...(request.body.externalReference === undefined
          ? {}
          : { externalReference: request.body.externalReference }),
        ...(request.body.productType === undefined
          ? {}
          : { productType: request.body.productType }),
      });

      return {
        success: true as const,
        data: toProductResponse(product),
      };
    },
  );

  typed.post(
    '/api/v1/products/:productId/deactivate',
    {
      schema: {
        tags: ['Products'],
        summary: 'Deactivate a product',
        params: productIdParamsSchema,
        response: {
          200: productSuccessResponseSchema,
        },
      },
    },
    async (request) => {
      const actor = requireActorContext();
      const { actorId, actorKind } = actorFields(actor);
      const { product } = await deps.deactivateProduct.execute({
        tenantId: actor.tenantId,
        actorId,
        actorKind,
        actorPermissions: actor.permissions,
        productId: request.params.productId,
      });

      return {
        success: true as const,
        data: toProductResponse(product),
      };
    },
  );

  typed.post(
    '/api/v1/products/:productId/archive',
    {
      schema: {
        tags: ['Products'],
        summary: 'Archive a product',
        params: productIdParamsSchema,
        response: {
          200: productSuccessResponseSchema,
        },
      },
    },
    async (request) => {
      const actor = requireActorContext();
      const { actorId, actorKind } = actorFields(actor);
      const { product } = await deps.archiveProduct.execute({
        tenantId: actor.tenantId,
        actorId,
        actorKind,
        actorPermissions: actor.permissions,
        productId: request.params.productId,
      });

      return {
        success: true as const,
        data: toProductResponse(product),
      };
    },
  );

  typed.get(
    '/api/v1/products/:productId/content',
    {
      schema: {
        tags: ['Products'],
        summary: 'List localized content for a product',
        params: productIdParamsSchema,
        response: {
          200: productContentListSuccessResponseSchema,
        },
      },
    },
    async (request) => {
      const actor = requireActorContext();
      const { content } = await deps.getProductContent.execute({
        tenantId: actor.tenantId,
        actorPermissions: actor.permissions,
        productId: request.params.productId,
      });

      return {
        success: true as const,
        data: content.map(toProductContentResponse),
      };
    },
  );

  typed.put(
    '/api/v1/products/:productId/content/:locale',
    {
      schema: {
        tags: ['Products'],
        summary: 'Upsert localized content for a product',
        params: productLocaleParamsSchema,
        body: upsertProductContentBodySchema,
        response: {
          200: productContentSuccessResponseSchema,
        },
      },
    },
    async (request) => {
      const actor = requireActorContext();
      const { actorId, actorKind } = actorFields(actor);
      const { content } = await deps.upsertProductContent.execute({
        tenantId: actor.tenantId,
        actorId,
        actorKind,
        actorPermissions: actor.permissions,
        productId: request.params.productId,
        locale: request.params.locale,
        ...(request.body.title === undefined ? {} : { title: request.body.title }),
        ...(request.body.description === undefined
          ? {}
          : { description: request.body.description }),
        ...(request.body.brand === undefined ? {} : { brand: request.body.brand }),
        ...(request.body.attributes === undefined ? {} : { attributes: request.body.attributes }),
      });

      return {
        success: true as const,
        data: toProductContentResponse(content),
      };
    },
  );

  await Promise.resolve();
};

export default productRoutes;
