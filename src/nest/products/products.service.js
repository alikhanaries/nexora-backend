import { Inject, Injectable } from '@nestjs/common';
import { toProductContentResponse, toProductResponse } from '../../modules/products/presentation/product.mapper.js';
import { requireActorContext } from '../../shared/context/require-principal.js';
import { productActorFields } from '../common/commerce-actor.js';
import { CORE_DOMAIN } from '../domain/core-domain.tokens.js';

export @Injectable()
class ProductsService {
  constructor(@Inject(CORE_DOMAIN) coreDomain) {
    this.coreDomain = coreDomain;
  }

  get useCases() {
    return this.coreDomain.products.useCases;
  }

  async listProducts(query) {
    const actor = requireActorContext();
    const page = await this.useCases.listProducts.execute({
      tenantId: actor.tenantId,
      actorPermissions: actor.permissions,
      ...(query.limit === undefined ? {} : { limit: query.limit }),
      ...(query.cursor === undefined ? {} : { cursor: query.cursor }),
      ...(query.status === undefined ? {} : { status: query.status }),
    });
    return {
      items: page.items.map(toProductResponse),
      nextCursor: page.nextCursor,
      hasMore: page.hasMore,
    };
  }

  async createProduct(body) {
    const actor = requireActorContext();
    const { actorId, actorKind } = productActorFields(actor);
    const { product } = await this.useCases.createProduct.execute({
      tenantId: actor.tenantId,
      actorId,
      actorKind,
      actorPermissions: actor.permissions,
      merchantSku: body.merchantSku,
      ...(body.externalReference === undefined ? {} : { externalReference: body.externalReference }),
      ...(body.productType === undefined ? {} : { productType: body.productType }),
    });
    return toProductResponse(product);
  }

  async getProduct(productId) {
    const actor = requireActorContext();
    const { product } = await this.useCases.getProduct.execute({
      tenantId: actor.tenantId,
      actorPermissions: actor.permissions,
      productId,
    });
    return toProductResponse(product);
  }

  async updateProduct(productId, body) {
    const actor = requireActorContext();
    const { actorId, actorKind } = productActorFields(actor);
    const { product } = await this.useCases.updateProduct.execute({
      tenantId: actor.tenantId,
      actorId,
      actorKind,
      actorPermissions: actor.permissions,
      productId,
      ...(body.externalReference === undefined ? {} : { externalReference: body.externalReference }),
      ...(body.productType === undefined ? {} : { productType: body.productType }),
    });
    return toProductResponse(product);
  }

  async deactivateProduct(productId) {
    const actor = requireActorContext();
    const { actorId, actorKind } = productActorFields(actor);
    const { product } = await this.useCases.deactivateProduct.execute({
      tenantId: actor.tenantId,
      actorId,
      actorKind,
      actorPermissions: actor.permissions,
      productId,
    });
    return toProductResponse(product);
  }

  async archiveProduct(productId) {
    const actor = requireActorContext();
    const { actorId, actorKind } = productActorFields(actor);
    const { product } = await this.useCases.archiveProduct.execute({
      tenantId: actor.tenantId,
      actorId,
      actorKind,
      actorPermissions: actor.permissions,
      productId,
    });
    return toProductResponse(product);
  }

  async getProductContent(productId) {
    const actor = requireActorContext();
    const { content } = await this.useCases.getProductContent.execute({
      tenantId: actor.tenantId,
      actorPermissions: actor.permissions,
      productId,
    });
    return content.map(toProductContentResponse);
  }

  async upsertProductContent(productId, locale, body) {
    const actor = requireActorContext();
    const { actorId, actorKind } = productActorFields(actor);
    const { content } = await this.useCases.upsertProductContent.execute({
      tenantId: actor.tenantId,
      actorId,
      actorKind,
      actorPermissions: actor.permissions,
      productId,
      locale,
      ...(body.title === undefined ? {} : { title: body.title }),
      ...(body.description === undefined ? {} : { description: body.description }),
      ...(body.brand === undefined ? {} : { brand: body.brand }),
      ...(body.attributes === undefined ? {} : { attributes: body.attributes }),
    });
    return toProductContentResponse(content);
  }
}
