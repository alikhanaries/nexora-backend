import { Inject, Injectable } from '@nestjs/common';
import { requireActorContext } from '../../shared/context/require-principal.js';
import { ValidationError } from '../../shared/errors/index.js';
import { actorFingerprint } from '../../shared/http/actor-fingerprint.js';
import { requireIdempotencyKey } from '../../shared/idempotency/index.js';
import {
  resolveStockConnectCeIdempotencyKey,
  stableIdempotencyFingerprint,
} from '../../modules/compatibility/application/resolve-stockconnect-ce-idempotency-key.js';
import { commerceActorFields } from '../common/commerce-actor.js';
import { CORE_DOMAIN } from '../domain/core-domain.tokens.js';
import { LegacyOrdersService } from '../legacy-orders/legacy-orders.service.js';

function readMerchantProductNosFromQuery(query) {
  const raw = query.merchantProductNoList ?? query.MerchantProductNoList ?? [];
  return (Array.isArray(raw) ? raw : [raw]).filter(
    (value) => typeof value === 'string' && value.length > 0,
  );
}

export @Injectable()
class LegacyCompatibilityService {
  constructor(
    @Inject(CORE_DOMAIN) coreDomain,
    @Inject(LegacyOrdersService) legacyOrdersService,
  ) {
    this.coreDomain = coreDomain;
    this.legacyOrdersService = legacyOrdersService;
  }

  get routeDeps() {
    return this.coreDomain.compatibility.routeDeps;
  }

  stockConnectMutationContext(body, routeId, idempotencyKeyHeader) {
    const actor = requireActorContext();
    const actorId = actor.userId ?? actor.apiKeyId ?? actor.tenantId;
    const actorKind = actor.userId !== undefined ? 'user' : 'api-key';
    return {
      tenantId: actor.tenantId,
      actorId,
      actorKind,
      actorPermissions: actor.permissions,
      principalFingerprint: actorFingerprint(actor),
      idempotencyKey: resolveStockConnectCeIdempotencyKey({
        header: idempotencyKeyHeader,
        tenantId: actor.tenantId,
        routeId,
        fingerprint: stableIdempotencyFingerprint(body),
      }),
      body,
    };
  }

  async pingV2() {
    await this.legacyOrdersService.enforceReadRateLimit();
    return {
      success: true,
      data: { message: 'pong', apiVersion: 'v2' },
    };
  }

  async listMerchantShipmentsV2(query) {
    await this.legacyOrdersService.enforceReadRateLimit();
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

  async createShipmentV2(body, idempotencyKeyHeader) {
    await this.legacyOrdersService.enforceMutationRateLimit();
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

  async updateShipmentTrackingV2(merchantShipmentNo, body, idempotencyKeyHeader) {
    await this.legacyOrdersService.enforceMutationRateLimit();
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

  async listMerchantCancellationsV2(query) {
    await this.legacyOrdersService.enforceReadRateLimit();
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

  async createCancellationV2(body, idempotencyKeyHeader) {
    await this.legacyOrdersService.enforceMutationRateLimit();
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

  async listNewMerchantReturnsV2(query) {
    await this.legacyOrdersService.enforceReadRateLimit();
    const actor = requireActorContext();
    return this.routeDeps.returnCompatibilityQuery.listNewMerchantReturns({
      tenantId: actor.tenantId,
      actorPermissions: actor.permissions,
      page: query.Page,
      pageSize: query.ItemsPerPage,
    });
  }

  async listReturnsByMerchantOrderNoV2(merchantOrderNo) {
    await this.legacyOrdersService.enforceReadRateLimit();
    const actor = requireActorContext();
    return this.routeDeps.returnCompatibilityQuery.listReturnsByMerchantOrderNo({
      tenantId: actor.tenantId,
      actorPermissions: actor.permissions,
      merchantOrderNo,
    });
  }

  async listMerchantReturnsV2(query) {
    await this.legacyOrdersService.enforceReadRateLimit();
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

  async receiveReturnV2(body, idempotencyKeyHeader) {
    await this.legacyOrdersService.enforceMutationRateLimit();
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

  async acknowledgeReturnV2(body, idempotencyKeyHeader) {
    await this.legacyOrdersService.enforceMutationRateLimit();
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

  async createReturnV2(body, idempotencyKeyHeader) {
    await this.legacyOrdersService.enforceMutationRateLimit();
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

  async listProductsV2(parsedQuery) {
    await this.legacyOrdersService.enforceReadRateLimit();
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

  async upsertProductsV2(body, idempotencyKeyHeader) {
    await this.legacyOrdersService.enforceMutationRateLimit();
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

  async freezeProductsV2(body, idempotencyKeyHeader, channelReferenceHeader) {
    await this.legacyOrdersService.enforceMutationRateLimit();
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

  async bulkDeleteProductsV2(body, idempotencyKeyHeader) {
    await this.legacyOrdersService.enforceMutationRateLimit();
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

  async patchExtraDataBulkV2(body, idempotencyKeyHeader) {
    await this.legacyOrdersService.enforceMutationRateLimit();
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

  async updateOfferPriceV2(body, idempotencyKeyHeader, channelReferenceHeader) {
    await this.legacyOrdersService.enforceMutationRateLimit();
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

  async updateOfferStockV2(body, idempotencyKeyHeader, channelReferenceHeader) {
    await this.legacyOrdersService.enforceMutationRateLimit();
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

  async createCancellationCe(body, idempotencyKeyHeader) {
    await this.legacyOrdersService.enforceMutationRateLimit();
    const ctx = this.stockConnectMutationContext(
      body,
      'POST /api/v2/ce/cancellations',
      idempotencyKeyHeader,
    );
    return this.routeDeps.cancellationCompatibilityCommand.createCancellation(ctx);
  }

  async createShipmentCe(body, idempotencyKeyHeader) {
    await this.legacyOrdersService.enforceMutationRateLimit();
    const ctx = this.stockConnectMutationContext(
      body,
      'POST /api/v2/ce/shipments',
      idempotencyKeyHeader,
    );
    return this.routeDeps.shipmentCompatibilityCommand.createShipment(ctx);
  }

  async listMerchantShipmentsCe(query) {
    await this.legacyOrdersService.enforceReadRateLimit();
    const actor = requireActorContext();
    return this.routeDeps.shipmentCompatibilityQuery.listMerchantShipments({
      tenantId: actor.tenantId,
      actorPermissions: actor.permissions,
      page: query.page,
      pageSize: query.pageSize,
    });
  }

  async listReturnsCe(query) {
    await this.legacyOrdersService.enforceReadRateLimit();
    const actor = requireActorContext();
    return this.routeDeps.returnCompatibilityQuery.listMerchantReturns({
      tenantId: actor.tenantId,
      actorPermissions: actor.permissions,
      page: query.page,
      pageSize: query.pageSize,
    });
  }

  async createReturnCe(body, idempotencyKeyHeader) {
    await this.legacyOrdersService.enforceMutationRateLimit();
    const ctx = this.stockConnectMutationContext(
      body,
      'POST /api/v2/ce/returns/merchant',
      idempotencyKeyHeader,
    );
    return this.routeDeps.returnCompatibilityCommand.createReturn(ctx);
  }

  async acknowledgeReturnCe(body, idempotencyKeyHeader) {
    await this.legacyOrdersService.enforceMutationRateLimit();
    const ctx = this.stockConnectMutationContext(
      body,
      'POST /api/v2/ce/returns/merchant/acknowledge',
      idempotencyKeyHeader,
    );
    return this.routeDeps.returnCompatibilityCommand.acknowledgeReturn(ctx);
  }

  async receiveReturnCe(body, idempotencyKeyHeader) {
    await this.legacyOrdersService.enforceMutationRateLimit();
    const ctx = this.stockConnectMutationContext(
      body,
      'PUT /api/v2/ce/returns',
      idempotencyKeyHeader,
    );
    return this.routeDeps.returnCompatibilityCommand.receiveReturn(ctx);
  }

  async listProductsCe(query) {
    await this.legacyOrdersService.enforceReadRateLimit();
    const actor = requireActorContext();
    const merchantProductNos = readMerchantProductNosFromQuery(query);
    if (merchantProductNos.length === 0) {
      throw new ValidationError('merchantProductNoList is required');
    }
    return this.routeDeps.stockConnectCeProductsQuery.listProductsByMerchantProductNos({
      tenantId: actor.tenantId,
      actorPermissions: actor.permissions,
      merchantProductNos,
    });
  }

  async listChannelProductsCe(channelId, query) {
    await this.legacyOrdersService.enforceReadRateLimit();
    const actor = requireActorContext();
    return this.routeDeps.stockConnectCeChannelProductsQuery.listChannelProducts({
      tenantId: actor.tenantId,
      actorPermissions: actor.permissions,
      ceChannelId: channelId,
      page: query.page,
      pageSize: query.pageSize,
    });
  }

  async listChannelsCe() {
    await this.legacyOrdersService.enforceReadRateLimit();
    const actor = requireActorContext();
    return this.routeDeps.stockConnectCeChannelCompatibilityQuery.listChannels({
      tenantId: actor.tenantId,
    });
  }

  async pushProductsCe(body, idempotencyKeyHeader) {
    await this.legacyOrdersService.enforceMutationRateLimit();
    const ctx = this.stockConnectMutationContext(
      body,
      'POST /api/v2/ce/products',
      idempotencyKeyHeader,
    );
    return this.routeDeps.stockConnectCeCatalogCommand.pushProducts(ctx);
  }

  async updateOfferStockCe(body, idempotencyKeyHeader) {
    await this.legacyOrdersService.enforceMutationRateLimit();
    const ctx = this.stockConnectMutationContext(
      body,
      'PUT /api/v2/ce/offer/stock',
      idempotencyKeyHeader,
    );
    return this.routeDeps.stockConnectCeCatalogCommand.updateOfferStock(ctx);
  }

  async updateOfferPriceCe(body, idempotencyKeyHeader) {
    await this.legacyOrdersService.enforceMutationRateLimit();
    const ctx = this.stockConnectMutationContext(
      body,
      'PUT /api/v2/ce/offer',
      idempotencyKeyHeader,
    );
    return this.routeDeps.stockConnectCeCatalogCommand.updateOfferPrice(ctx);
  }

  async freezeProductsCe(body, idempotencyKeyHeader) {
    await this.legacyOrdersService.enforceMutationRateLimit();
    const ctx = this.stockConnectMutationContext(
      body,
      'POST /api/v2/ce/products/freeze',
      idempotencyKeyHeader,
    );
    return this.routeDeps.stockConnectCeCatalogCommand.freezeProducts(ctx);
  }

  async bulkDeleteProductsCe(body, idempotencyKeyHeader) {
    await this.legacyOrdersService.enforceMutationRateLimit();
    const ctx = this.stockConnectMutationContext(
      body,
      'POST /api/v2/ce/products/bulkdelete',
      idempotencyKeyHeader,
    );
    return this.routeDeps.stockConnectCeCatalogCommand.bulkDeleteProducts(ctx);
  }

  async patchExtraDataCe(body, idempotencyKeyHeader) {
    await this.legacyOrdersService.enforceMutationRateLimit();
    const ctx = this.stockConnectMutationContext(
      body,
      'PATCH /api/v2/ce/products/extra-data/bulk',
      idempotencyKeyHeader,
    );
    return this.routeDeps.stockConnectCeCatalogCommand.patchExtraData(ctx);
  }

  async updateShipmentDeliveryStateCe(merchantShipmentNo, body, idempotencyKeyHeader) {
    await this.legacyOrdersService.enforceMutationRateLimit();
    const ctx = this.stockConnectMutationContext(
      body,
      'PUT /api/v2/ce/shipments/:merchantShipmentNo/delivery-state',
      idempotencyKeyHeader,
    );
    return this.routeDeps.stockConnectCeShipmentDeliveryCommand.updateDeliveryState({
      ...ctx,
      merchantShipmentNo,
    });
  }
}
