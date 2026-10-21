import { toProductResponse } from '../../../products/views/product.mapper.js';
import { toOfferResponse } from '../../../offers/views/offer.mapper.js';
import {
  toBalanceResponse,
  toBalanceSnapshotResponse,
} from '../../../inventory/views/inventory.mapper.js';
import { optionalReferenceFields } from '../../../inventory/services/optional-fields.js';
import { requireActorContext } from '../../../../shared/context/require-principal.js';
import { withCommerceMetric } from '../../../../shared/metrics/record-commerce-operation.js';
import { commerceActorFields, productActorFields } from '../../../../app/common/commerce-actor.js';

/**
 * Catalog / inventory use-case calls shared by Stock Connect v2 HTTP adapters.
 * Calls module use cases directly (no Nest service classes).
 *
 * @param {object} coreServices
 */
export function createStockConnectCatalogCommands(coreServices) {
  const products = () => coreServices.products.useCases;
  const offers = () => coreServices.offers.useCases;
  const inventory = () => coreServices.inventory.useCases;

  return {
    async listProducts(query) {
      const actor = requireActorContext();
      const page = await products().listProducts.execute({
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
    },

    async getProduct(productId) {
      const actor = requireActorContext();
      const { product } = await products().getProduct.execute({
        tenantId: actor.tenantId,
        actorPermissions: actor.permissions,
        productId,
      });
      return toProductResponse(product);
    },

    async createProduct(body) {
      const actor = requireActorContext();
      const { actorId, actorKind } = productActorFields(actor);
      const { product } = await products().createProduct.execute({
        tenantId: actor.tenantId,
        actorId,
        actorKind,
        actorPermissions: actor.permissions,
        merchantSku: body.merchantSku,
        ...(body.externalReference === undefined ? {} : { externalReference: body.externalReference }),
        ...(body.productType === undefined ? {} : { productType: body.productType }),
      });
      return toProductResponse(product);
    },

    async updateProduct(productId, body) {
      const actor = requireActorContext();
      const { actorId, actorKind } = productActorFields(actor);
      const { product } = await products().updateProduct.execute({
        tenantId: actor.tenantId,
        actorId,
        actorKind,
        actorPermissions: actor.permissions,
        productId,
        ...(body.externalReference === undefined ? {} : { externalReference: body.externalReference }),
        ...(body.productType === undefined ? {} : { productType: body.productType }),
      });
      return toProductResponse(product);
    },

    async createOffer(body) {
      const actor = requireActorContext();
      const { actorId, actorKind } = commerceActorFields(actor);
      const { offer } = await offers().createOffer.execute({
        tenantId: actor.tenantId,
        actorId,
        actorKind,
        actorPermissions: actor.permissions,
        productId: body.productId,
        channelId: body.channelId,
        ...(body.externalReference === undefined ? {} : { externalReference: body.externalReference }),
        ...(body.priceReference === undefined ? {} : { priceReference: body.priceReference }),
      });
      return toOfferResponse(offer);
    },

    async activateOffer(offerId, body) {
      const actor = requireActorContext();
      const { actorId, actorKind } = commerceActorFields(actor);
      const { offer } = await offers().activateOffer.execute({
        tenantId: actor.tenantId,
        actorId,
        actorKind,
        actorPermissions: actor.permissions,
        offerId,
        ...(body.resolvePricing === undefined ? {} : { resolvePricing: body.resolvePricing }),
        ...(body.currency === undefined ? {} : { currency: body.currency }),
      });
      return toOfferResponse(offer);
    },

    async listInventory(query, productId) {
      const actor = requireActorContext();
      const { balances } = await inventory().getInventory.execute({
        tenantId: actor.tenantId,
        actorPermissions: actor.permissions,
        ...(productId === undefined ? {} : { productId }),
        ...(query.stockLocationId === undefined ? {} : { stockLocationId: query.stockLocationId }),
      });
      return balances.map(toBalanceResponse);
    },

    async adjustInventory(body) {
      const actor = requireActorContext();
      const result = await withCommerceMetric(coreServices.metrics, 'inventory.adjust', () =>
        inventory().adjustInventory.execute({
          tenantId: actor.tenantId,
          actorPermissions: actor.permissions,
          stockLocationId: body.stockLocationId,
          productId: body.productId,
          delta: body.delta,
          ...optionalReferenceFields(body),
        }),
      );
      return {
        idempotent: result.idempotent,
        balance: toBalanceSnapshotResponse(result.balance),
      };
    },
  };
}
