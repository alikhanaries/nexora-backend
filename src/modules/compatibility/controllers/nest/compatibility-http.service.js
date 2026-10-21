/**
 * Nest injectable facade for compatibility v2 and CE HTTP handlers.
 * Builds actor/idempotency context and forwards to `CORE_SERVICES.compatibility.routeDeps` and CompatibilityOrdersService.
 */
import { Inject, Injectable } from '@nestjs/common';
import { requireActorContext } from '../../../../shared/context/require-principal.js';
import { ValidationError } from '../../../../shared/errors/index.js';
import { actorFingerprint } from '../../../../shared/http/actor-fingerprint.js';
import { requireIdempotencyKey } from '../../../../shared/idempotency/index.js';
import {
  resolveCompatV2IdempotencyKey,
  stableIdempotencyFingerprint,
} from '../../services/resolve-compat-v2-idempotency-key.js';
import { commerceActorFields } from '../../../../app/common/commerce-actor.js';
import { CORE_SERVICES } from '../../../../app/di/core-services.tokens.js';
import { CompatibilityOrdersService } from './compatibility-orders.service.js';

/**
 * Normalizes CE product list query params to a non-empty string array of merchant SKUs.
 * Accepts camelCase or PascalCase list keys; filters blank entries.
 * @param {object} query Parsed CE products query.
 * @returns {string[]} Merchant product numbers (may be empty when omitted).
 */
function readMerchantProductNosFromQuery(query) {
  const raw = query.merchantProductNoList ?? query.MerchantProductNoList ?? [];
  return (Array.isArray(raw) ? raw : [raw]).filter(
    (value) => typeof value === 'string' && value.length > 0,
  );
}

/** Shared delegation layer for CompatibilityV2Controller and CompatV2Controller. */
@Injectable()
class CompatibilityHttpService {
  /**
   * @param {import('../../../../app/di/core-services.module.js').CoreServices} coreServices CORE_SERVICES token.
   * @param {CompatibilityOrdersService} compatibilityOrdersService Shared rate-limit helper for reads/writes.
   */
  constructor(
    @Inject(CORE_SERVICES) coreServices,
    @Inject(CompatibilityOrdersService) compatibilityOrdersService,
  ) {
    this.coreServices = coreServices;
    this.compatibilityOrdersService = compatibilityOrdersService;
  }

  /** Wired compatibility facades from DI (`routeDeps` on compatibility module). */
  get routeDeps() {
    return this.coreServices.compatibility.routeDeps;
  }

  /**
   * Builds tenant-scoped mutation input for `/api/v2/ce/*` handlers.
   * Steps: require actor → fingerprint principal → resolve idempotency (header or body fingerprint digest).
   * @param {unknown} body Request body used for stable idempotency fingerprint when header absent.
   * @param {string} routeId Logical route id (e.g. `POST /api/v2/ce/products`).
   * @param {string | string[] | undefined} idempotencyKeyHeader Raw `Idempotency-Key` header.
   * @returns {object} Spread into routeDeps command inputs (includes `tenantId`, permissions, `idempotencyKey`).
   */
  compatV2MutationContext(body, routeId, idempotencyKeyHeader) {
    const actor = requireActorContext();
    const actorId = actor.userId ?? actor.apiKeyId ?? actor.tenantId;
    const actorKind = actor.userId !== undefined ? 'user' : 'api-key';
    return {
      tenantId: actor.tenantId,
      actorId,
      actorKind,
      actorPermissions: actor.permissions,
      principalFingerprint: actorFingerprint(actor),
      idempotencyKey: resolveCompatV2IdempotencyKey({
        header: idempotencyKeyHeader,
        tenantId: actor.tenantId,
        routeId,
        fingerprint: stableIdempotencyFingerprint(body),
      }),
      body,
    };
  }

  /** Merchant compatibility v2 ping — read rate limit, returns static pong payload. */
  async pingV2() {
    await this.compatibilityOrdersService.enforceReadRateLimit();
    return {
      success: true,
      data: { message: 'pong', apiVersion: 'v2' },
    };
  }

  /** `/api/v2/shipments/merchant` — maps PascalCase query fields to shipmentCompatibilityQuery filters. */
  async listMerchantShipmentsV2(query) {
    await this.compatibilityOrdersService.enforceReadRateLimit();
    const actor = requireActorContext();
    return this.routeDeps.shipmentCompatibilityQuery.listMerchantShipments({
      tenantId: actor.tenantId,
      actorPermissions: actor.permissions,
      page: query.Page,
      pageSize: query.ItemsPerPage,
      merchantShipmentNos: query.MerchantShipmentNos,
      merchantOrderNos: query.MerchantOrderNos,
      channelOrderNos: query.ChannelOrderNos,
      method: query.Method,
      fromShipmentDate: query.FromShipmentDate,
      toShipmentDate: query.ToShipmentDate,
      fromCreateDate: query.FromCreateDate,
      toCreateDate: query.ToCreateDate,
      fromUpdateDate: query.FromUpdateDate,
      toUpdateDate: query.ToUpdateDate,
      fromDeliveredAt: query.FromDeliveredAt,
      toDeliveredAt: query.ToDeliveredAt,
    });
  }

  /** `/api/v2/shipments` POST — mutation rate limit, required idempotency key, shipment command. */
  async createShipmentV2(body, idempotencyKeyHeader) {
    await this.compatibilityOrdersService.enforceMutationRateLimit();
    const actor = requireActorContext();
    const { actorId, actorKind } = commerceActorFields(actor);
    const idempotencyKey = requireIdempotencyKey(idempotencyKeyHeader);
    return this.routeDeps.shipmentCompatibilityCommand.createShipment({
      tenantId: actor.tenantId,
      actorId,
      actorKind,
      actorPermissions: actor.permissions,
      body,
      idempotencyKey,
      principalFingerprint: actorFingerprint(actor),
    });
  }

  /** `/api/v2/shipments/:merchantShipmentNo` PUT — tracking update with idempotency. */
  async updateShipmentTrackingV2(merchantShipmentNo, body, idempotencyKeyHeader) {
    await this.compatibilityOrdersService.enforceMutationRateLimit();
    const actor = requireActorContext();
    const { actorId, actorKind } = commerceActorFields(actor);
    const idempotencyKey = requireIdempotencyKey(idempotencyKeyHeader);
    return this.routeDeps.shipmentCompatibilityCommand.updateShipmentTracking({
      tenantId: actor.tenantId,
      actorId,
      actorKind,
      actorPermissions: actor.permissions,
      merchantShipmentNo,
      body,
      idempotencyKey,
      principalFingerprint: actorFingerprint(actor),
    });
  }

  /** `/api/v2/cancellations/merchant` — cancellation list with external id enrichment. */
  async listMerchantCancellationsV2(query) {
    await this.compatibilityOrdersService.enforceReadRateLimit();
    const actor = requireActorContext();
    return this.routeDeps.cancellationCompatibilityQuery.listMerchantCancellations({
      tenantId: actor.tenantId,
      actorPermissions: actor.permissions,
      page: query.Page,
      pageSize: query.ItemsPerPage,
      createdSince: query.CreatedSince,
      createdTo: query.CreatedTo,
      updatedSince: query.UpdatedSince,
      updatedTo: query.UpdatedTo,
      channelOrderNos: query.ChannelOrderNos,
      merchantOrderNos: query.MerchantOrderNos,
      merchantCancellationNos: query.MerchantCancellationNos,
    });
  }

  /** `/api/v2/cancellations` POST — create cancellation (merchant v2 idempotency header required). */
  async createCancellationV2(body, idempotencyKeyHeader) {
    await this.compatibilityOrdersService.enforceMutationRateLimit();
    const actor = requireActorContext();
    const { actorId, actorKind } = commerceActorFields(actor);
    const idempotencyKey = requireIdempotencyKey(idempotencyKeyHeader);
    return this.routeDeps.cancellationCompatibilityCommand.createCancellation({
      tenantId: actor.tenantId,
      actorId,
      actorKind,
      actorPermissions: actor.permissions,
      body,
      idempotencyKey,
      principalFingerprint: actorFingerprint(actor),
    });
  }

  /** `/api/v2/returns/merchant/new` — new-return status preset on returnCompatibilityQuery. */
  async listNewMerchantReturnsV2(query) {
    await this.compatibilityOrdersService.enforceReadRateLimit();
    const actor = requireActorContext();
    return this.routeDeps.returnCompatibilityQuery.listNewMerchantReturns({
      tenantId: actor.tenantId,
      actorPermissions: actor.permissions,
      page: query.Page,
      pageSize: query.ItemsPerPage,
    });
  }

  /** `/api/v2/returns/merchant/:merchantOrderNo` — single-order return collection. */
  async listReturnsByMerchantOrderNoV2(merchantOrderNo) {
    await this.compatibilityOrdersService.enforceReadRateLimit();
    const actor = requireActorContext();
    return this.routeDeps.returnCompatibilityQuery.listReturnsByMerchantOrderNo({
      tenantId: actor.tenantId,
      actorPermissions: actor.permissions,
      merchantOrderNo,
    });
  }

  /** `/api/v2/returns/merchant` — filtered return page with channel/order enrichment. */
  async listMerchantReturnsV2(query) {
    await this.compatibilityOrdersService.enforceReadRateLimit();
    const actor = requireActorContext();
    return this.routeDeps.returnCompatibilityQuery.listMerchantReturns({
      tenantId: actor.tenantId,
      actorPermissions: actor.permissions,
      page: query.Page,
      pageSize: query.ItemsPerPage,
      merchantOrderNos: query.MerchantOrderNos,
      channelOrderNos: query.ChannelOrderNos,
      externalStatuses: query.Statuses,
      reasons: query.Reasons,
      fromDate: query.FromDate,
      toDate: query.ToDate,
      fromUpdateDate: query.FromUpdateDate,
      toUpdateDate: query.ToUpdateDate,
    });
  }

  /** `/api/v2/returns` PUT — receive return command + idempotency. */
  async receiveReturnV2(body, idempotencyKeyHeader) {
    await this.compatibilityOrdersService.enforceMutationRateLimit();
    const actor = requireActorContext();
    const { actorId, actorKind } = commerceActorFields(actor);
    const idempotencyKey = requireIdempotencyKey(idempotencyKeyHeader);
    return this.routeDeps.returnCompatibilityCommand.receiveReturn({
      tenantId: actor.tenantId,
      actorId,
      actorKind,
      actorPermissions: actor.permissions,
      body,
      idempotencyKey,
      principalFingerprint: actorFingerprint(actor),
    });
  }

  /** `/api/v2/returns/merchant/acknowledge` POST — acknowledge return mutation. */
  async acknowledgeReturnV2(body, idempotencyKeyHeader) {
    await this.compatibilityOrdersService.enforceMutationRateLimit();
    const actor = requireActorContext();
    const { actorId, actorKind } = commerceActorFields(actor);
    const idempotencyKey = requireIdempotencyKey(idempotencyKeyHeader);
    return this.routeDeps.returnCompatibilityCommand.acknowledgeReturn({
      tenantId: actor.tenantId,
      actorId,
      actorKind,
      actorPermissions: actor.permissions,
      body,
      idempotencyKey,
      principalFingerprint: actorFingerprint(actor),
    });
  }

  /** `/api/v2/returns` POST — merchant return create. */
  async createReturnV2(body, idempotencyKeyHeader) {
    await this.compatibilityOrdersService.enforceMutationRateLimit();
    const actor = requireActorContext();
    const { actorId, actorKind } = commerceActorFields(actor);
    const idempotencyKey = requireIdempotencyKey(idempotencyKeyHeader);
    return this.routeDeps.returnCompatibilityCommand.createReturn({
      tenantId: actor.tenantId,
      actorId,
      actorKind,
      actorPermissions: actor.permissions,
      body,
      idempotencyKey,
      principalFingerprint: actorFingerprint(actor),
    });
  }

  /** `/api/v2/products` GET — requires merchantProductNos; catalogCompatibilityQuery by SKU list. */
  async listProductsV2(parsedQuery) {
    await this.compatibilityOrdersService.enforceReadRateLimit();
    const actor = requireActorContext();
    if (parsedQuery.merchantProductNos.length === 0) {
      throw new ValidationError('merchantProductNoList is required');
    }
    return this.routeDeps.catalogCompatibilityQuery.listProductsByMerchantProductNos({
      tenantId: actor.tenantId,
      actorPermissions: actor.permissions,
      merchantProductNos: parsedQuery.merchantProductNos,
    });
  }

  /** `/api/v2/products` POST — catalog upsert batch with idempotency store replay. */
  async upsertProductsV2(body, idempotencyKeyHeader) {
    await this.compatibilityOrdersService.enforceMutationRateLimit();
    const actor = requireActorContext();
    const { actorId, actorKind } = commerceActorFields(actor);
    const idempotencyKey = requireIdempotencyKey(idempotencyKeyHeader);
    return this.routeDeps.catalogCompatibilityCommand.upsertProducts({
      tenantId: actor.tenantId,
      actorId,
      actorKind,
      actorPermissions: actor.permissions,
      body,
      idempotencyKey,
      principalFingerprint: actorFingerprint(actor),
    });
  }

  /**
   * `/api/v2/products/freeze` — freeze products/offers; passes api key channel + `x-channel-reference` for scope.
   * @param {string | string[] | undefined} channelReferenceHeader Optional integration reference header.
   */
  async freezeProductsV2(body, idempotencyKeyHeader, channelReferenceHeader) {
    await this.compatibilityOrdersService.enforceMutationRateLimit();
    const actor = requireActorContext();
    const { actorId, actorKind } = commerceActorFields(actor);
    const idempotencyKey = requireIdempotencyKey(idempotencyKeyHeader);
    return this.routeDeps.catalogCompatibilityCommand.freezeProducts({
      tenantId: actor.tenantId,
      actorId,
      actorKind,
      actorPermissions: actor.permissions,
      apiKeyChannelId: actor.apiKeyChannelId,
      channelExternalReference:
        typeof channelReferenceHeader === 'string' ? channelReferenceHeader : undefined,
      body,
      idempotencyKey,
      principalFingerprint: actorFingerprint(actor),
    });
  }

  /** `/api/v2/products/bulkdelete` — deactivate products by SKU list. */
  async bulkDeleteProductsV2(body, idempotencyKeyHeader) {
    await this.compatibilityOrdersService.enforceMutationRateLimit();
    const actor = requireActorContext();
    const { actorId, actorKind } = commerceActorFields(actor);
    const idempotencyKey = requireIdempotencyKey(idempotencyKeyHeader);
    return this.routeDeps.catalogCompatibilityCommand.bulkDeleteProducts({
      tenantId: actor.tenantId,
      actorId,
      actorKind,
      actorPermissions: actor.permissions,
      body,
      idempotencyKey,
      principalFingerprint: actorFingerprint(actor),
    });
  }

  /** `/api/v2/products/extra-data/bulk` PATCH — merge extra-data on products. */
  async patchExtraDataBulkV2(body, idempotencyKeyHeader) {
    await this.compatibilityOrdersService.enforceMutationRateLimit();
    const actor = requireActorContext();
    const { actorId, actorKind } = commerceActorFields(actor);
    const idempotencyKey = requireIdempotencyKey(idempotencyKeyHeader);
    return this.routeDeps.catalogCompatibilityCommand.patchExtraDataBulk({
      tenantId: actor.tenantId,
      actorId,
      actorKind,
      actorPermissions: actor.permissions,
      body,
      idempotencyKey,
      principalFingerprint: actorFingerprint(actor),
    });
  }

  /** `/api/v2/offer` PUT — price update with channel resolution from api key + reference header. */
  async updateOfferPriceV2(body, idempotencyKeyHeader, channelReferenceHeader) {
    await this.compatibilityOrdersService.enforceMutationRateLimit();
    const actor = requireActorContext();
    const { actorId, actorKind } = commerceActorFields(actor);
    const idempotencyKey = requireIdempotencyKey(idempotencyKeyHeader);
    return this.routeDeps.catalogCompatibilityCommand.updateOfferPrice({
      tenantId: actor.tenantId,
      actorId,
      actorKind,
      actorPermissions: actor.permissions,
      apiKeyChannelId: actor.apiKeyChannelId,
      channelExternalReference:
        typeof channelReferenceHeader === 'string' ? channelReferenceHeader : undefined,
      body,
      idempotencyKey,
      principalFingerprint: actorFingerprint(actor),
    });
  }

  /** `/api/v2/offer/stock` PUT — absolute stock targets with inventory adjust per line. */
  async updateOfferStockV2(body, idempotencyKeyHeader, channelReferenceHeader) {
    await this.compatibilityOrdersService.enforceMutationRateLimit();
    const actor = requireActorContext();
    const { actorId, actorKind } = commerceActorFields(actor);
    const idempotencyKey = requireIdempotencyKey(idempotencyKeyHeader);
    return this.routeDeps.catalogCompatibilityCommand.updateOfferStock({
      tenantId: actor.tenantId,
      actorId,
      actorKind,
      actorPermissions: actor.permissions,
      apiKeyChannelId: actor.apiKeyChannelId,
      channelExternalReference:
        typeof channelReferenceHeader === 'string' ? channelReferenceHeader : undefined,
      body,
      idempotencyKey,
      principalFingerprint: actorFingerprint(actor),
    });
  }

  /** `/api/v2/ce/cancellations` — CE mutation context + cancellationCompatibilityCommand. */
  async createCancellationForCompatV2(body, idempotencyKeyHeader) {
    await this.compatibilityOrdersService.enforceMutationRateLimit();
    const ctx = this.compatV2MutationContext(
      body,
      'POST /api/v2/ce/cancellations',
      idempotencyKeyHeader,
    );
    return this.routeDeps.cancellationCompatibilityCommand.createCancellation(ctx);
  }

  /** `/api/v2/ce/shipments` POST — CE shipment create with derived idempotency when header omitted. */
  async createShipmentForCompatV2(body, idempotencyKeyHeader) {
    await this.compatibilityOrdersService.enforceMutationRateLimit();
    const ctx = this.compatV2MutationContext(
      body,
      'POST /api/v2/ce/shipments',
      idempotencyKeyHeader,
    );
    return this.routeDeps.shipmentCompatibilityCommand.createShipment(ctx);
  }

  /** `/api/v2/ce/shipments/merchant` — simplified page/pageSize shipment list for CE poll. */
  async listMerchantShipmentsForCompatV2(query) {
    await this.compatibilityOrdersService.enforceReadRateLimit();
    const actor = requireActorContext();
    return this.routeDeps.shipmentCompatibilityQuery.listMerchantShipments({
      tenantId: actor.tenantId,
      actorPermissions: actor.permissions,
      page: query.page,
      pageSize: query.pageSize,
    });
  }

  /** `/api/v2/ce/returns` GET — paginated returns (CE query shape). */
  async listReturnsForCompatV2(query) {
    await this.compatibilityOrdersService.enforceReadRateLimit();
    const actor = requireActorContext();
    return this.routeDeps.returnCompatibilityQuery.listMerchantReturns({
      tenantId: actor.tenantId,
      actorPermissions: actor.permissions,
      page: query.page,
      pageSize: query.pageSize,
    });
  }

  /** `/api/v2/ce/returns/merchant` POST — CE return create. */
  async createReturnForCompatV2(body, idempotencyKeyHeader) {
    await this.compatibilityOrdersService.enforceMutationRateLimit();
    const ctx = this.compatV2MutationContext(
      body,
      'POST /api/v2/ce/returns/merchant',
      idempotencyKeyHeader,
    );
    return this.routeDeps.returnCompatibilityCommand.createReturn(ctx);
  }

  /** `/api/v2/ce/returns/merchant/acknowledge` POST — CE return acknowledge. */
  async acknowledgeReturnForCompatV2(body, idempotencyKeyHeader) {
    await this.compatibilityOrdersService.enforceMutationRateLimit();
    const ctx = this.compatV2MutationContext(
      body,
      'POST /api/v2/ce/returns/merchant/acknowledge',
      idempotencyKeyHeader,
    );
    return this.routeDeps.returnCompatibilityCommand.acknowledgeReturn(ctx);
  }

  /** `/api/v2/ce/returns` PUT — CE receive return. */
  async receiveReturnForCompatV2(body, idempotencyKeyHeader) {
    await this.compatibilityOrdersService.enforceMutationRateLimit();
    const ctx = this.compatV2MutationContext(
      body,
      'PUT /api/v2/ce/returns',
      idempotencyKeyHeader,
    );
    return this.routeDeps.returnCompatibilityCommand.receiveReturn(ctx);
  }

  /** `/api/v2/ce/products` GET — compatV2ProductsQuery by merchant SKU list from query string. */
  async listProductsForCompatV2(query) {
    await this.compatibilityOrdersService.enforceReadRateLimit();
    const actor = requireActorContext();
    const merchantProductNos = readMerchantProductNosFromQuery(query);
    if (merchantProductNos.length === 0) {
      throw new ValidationError('merchantProductNoList is required');
    }
    return this.routeDeps.compatV2ProductsQuery.listProductsByMerchantProductNos({
      tenantId: actor.tenantId,
      actorPermissions: actor.permissions,
      merchantProductNos,
    });
  }

  /**
   * `/api/v2/ce/channels/:channelId/products` — channel-scoped product page.
   * @param {number} channelId External integer channel id from path (CE reference).
   */
  async listIntegrationProductsForCompatV2(channelId, query) {
    await this.compatibilityOrdersService.enforceReadRateLimit();
    const actor = requireActorContext();
    return this.routeDeps.compatV2IntegrationProductsQuery.listChannelProducts({
      tenantId: actor.tenantId,
      actorPermissions: actor.permissions,
      ceChannelId: channelId,
      page: query.page,
      pageSize: query.pageSize,
    });
  }

  /** `/api/v2/ce/channels` GET — tenant integration list in CE envelope. */
  async listIntegrationsForCompatV2() {
    await this.compatibilityOrdersService.enforceReadRateLimit();
    const actor = requireActorContext();
    return this.routeDeps.compatV2IntegrationListQuery.listCommerceIntegrations({
      tenantId: actor.tenantId,
    });
  }

  /** `/api/v2/ce/products` POST — compatV2CatalogCommand.pushProducts with CE idempotency context. */
  async pushProductsForCompatV2(body, idempotencyKeyHeader) {
    await this.compatibilityOrdersService.enforceMutationRateLimit();
    const ctx = this.compatV2MutationContext(
      body,
      'POST /api/v2/ce/products',
      idempotencyKeyHeader,
    );
    return this.routeDeps.compatV2CatalogCommand.pushProducts(ctx);
  }

  /** `/api/v2/ce/offer/stock` PUT — CE catalog stock update command. */
  async updateOfferStockForCompatV2(body, idempotencyKeyHeader) {
    await this.compatibilityOrdersService.enforceMutationRateLimit();
    const ctx = this.compatV2MutationContext(
      body,
      'PUT /api/v2/ce/offer/stock',
      idempotencyKeyHeader,
    );
    return this.routeDeps.compatV2CatalogCommand.updateOfferStock(ctx);
  }

  /** `/api/v2/ce/offer` PUT — CE catalog price update command. */
  async updateOfferPriceForCompatV2(body, idempotencyKeyHeader) {
    await this.compatibilityOrdersService.enforceMutationRateLimit();
    const ctx = this.compatV2MutationContext(
      body,
      'PUT /api/v2/ce/offer',
      idempotencyKeyHeader,
    );
    return this.routeDeps.compatV2CatalogCommand.updateOfferPrice(ctx);
  }

  /** `/api/v2/ce/products/freeze` POST — CE freeze products command. */
  async freezeProductsForCompatV2(body, idempotencyKeyHeader) {
    await this.compatibilityOrdersService.enforceMutationRateLimit();
    const ctx = this.compatV2MutationContext(
      body,
      'POST /api/v2/ce/products/freeze',
      idempotencyKeyHeader,
    );
    return this.routeDeps.compatV2CatalogCommand.freezeProducts(ctx);
  }

  /** `/api/v2/ce/products/bulkdelete` POST — CE bulk deactivate products. */
  async bulkDeleteProductsForCompatV2(body, idempotencyKeyHeader) {
    await this.compatibilityOrdersService.enforceMutationRateLimit();
    const ctx = this.compatV2MutationContext(
      body,
      'POST /api/v2/ce/products/bulkdelete',
      idempotencyKeyHeader,
    );
    return this.routeDeps.compatV2CatalogCommand.bulkDeleteProducts(ctx);
  }

  /** `/api/v2/ce/products/extra-data/bulk` PATCH — CE extra-data patch command. */
  async patchExtraDataForCompatV2(body, idempotencyKeyHeader) {
    await this.compatibilityOrdersService.enforceMutationRateLimit();
    const ctx = this.compatV2MutationContext(
      body,
      'PATCH /api/v2/ce/products/extra-data/bulk',
      idempotencyKeyHeader,
    );
    return this.routeDeps.compatV2CatalogCommand.patchExtraData(ctx);
  }

  /**
   * `/api/v2/ce/shipments/:merchantShipmentNo/delivery-state` PUT — updates delivery state on shipment.
   * @param {string} merchantShipmentNo External merchant shipment reference.
   */
  async updateShipmentDeliveryStateForCompatV2(merchantShipmentNo, body, idempotencyKeyHeader) {
    await this.compatibilityOrdersService.enforceMutationRateLimit();
    const ctx = this.compatV2MutationContext(
      body,
      'PUT /api/v2/ce/shipments/:merchantShipmentNo/delivery-state',
      idempotencyKeyHeader,
    );
    return this.routeDeps.compatV2ShipmentDeliveryCommand.updateDeliveryState({
      ...ctx,
      merchantShipmentNo,
    });
  }
}
export { CompatibilityHttpService };
