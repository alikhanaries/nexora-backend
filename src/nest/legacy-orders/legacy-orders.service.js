import { Inject, Injectable } from '@nestjs/common';
import { COMPATIBILITY_RATE_LIMIT_POLICIES } from '../../shared/auth/rate-limit-policies.js';
import { requireActorContext } from '../../shared/context/require-principal.js';
import { actorFingerprint } from '../../shared/http/actor-fingerprint.js';
import { requireIdempotencyKey } from '../../shared/idempotency/index.js';
import { enforceCompatibilityRateLimit } from '../../modules/compatibility/application/enforce-compatibility-rate-limit.js';
import {
  resolveStockConnectCeIdempotencyKey,
  stableIdempotencyFingerprint,
} from '../../modules/compatibility/application/resolve-stockconnect-ce-idempotency-key.js';
import { commerceActorFields } from '../common/commerce-actor.js';
import { CORE_DOMAIN } from '../domain/core-domain.tokens.js';

export @Injectable()
class LegacyOrdersService {
  constructor(@Inject(CORE_DOMAIN) coreDomain) {
    this.coreDomain = coreDomain;
  }

  get routeDeps() {
    return this.coreDomain.compatibility.routeDeps;
  }

  async enforceReadRateLimit() {
    const actor = requireActorContext();
    await enforceCompatibilityRateLimit({
      rateLimiter: this.routeDeps.rateLimiter,
      actor,
      policy: COMPATIBILITY_RATE_LIMIT_POLICIES.read,
      category: 'read',
    });
  }

  async enforceMutationRateLimit() {
    const actor = requireActorContext();
    await enforceCompatibilityRateLimit({
      rateLimiter: this.routeDeps.rateLimiter,
      actor,
      policy: COMPATIBILITY_RATE_LIMIT_POLICIES.mutation,
      category: 'mutation',
    });
  }

  /**
   * @param {import('zod').infer<typeof import('../../modules/compatibility/presentation/compatibility-order.schemas.js').listOrdersQuerySchema>} query
   */
  async listOrdersV2(query) {
    await this.enforceReadRateLimit();
    const actor = requireActorContext();
    return this.routeDeps.orderCompatibilityQuery.listOrders({
      tenantId: actor.tenantId,
      actorPermissions: actor.permissions,
      page: query.Page,
      pageSize: query.ItemsPerPage,
      externalStatuses: query.Statuses,
      merchantOrderNos: query.MerchantOrderNos,
      channelOrderNos: query.ChannelOrderNos,
      fromDate: query.FromDate,
      toDate: query.ToDate,
      fromCreatedAtDate: query.FromCreatedAtDate,
      toCreatedAtDate: query.ToCreatedAtDate,
      fromUpdatedAtDate: query.FromUpdatedAtDate,
      toUpdatedAtDate: query.ToUpdatedAtDate,
    });
  }

  /**
   * @param {import('zod').infer<typeof import('../../modules/compatibility/presentation/compatibility-order.schemas.js').listNewOrdersQuerySchema>} query
   */
  async listNewOrdersV2(query) {
    await this.enforceReadRateLimit();
    const actor = requireActorContext();
    return this.routeDeps.orderCompatibilityQuery.listNewOrders({
      tenantId: actor.tenantId,
      actorPermissions: actor.permissions,
      page: query.Page,
      pageSize: query.ItemsPerPage,
    });
  }

  /**
   * @param {import('zod').infer<typeof import('../../modules/compatibility/presentation/compatibility-channel-order.schemas.js').createChannelOrderBodySchema>} body
   * @param {string | string[] | undefined} idempotencyKeyHeader
   * @param {string | string[] | undefined} channelReferenceHeader
   */
  async createChannelOrderV2(body, idempotencyKeyHeader, channelReferenceHeader) {
    await this.enforceMutationRateLimit();
    const actor = requireActorContext();
    const { actorId, actorKind } = commerceActorFields(actor);
    const idempotencyKey = requireIdempotencyKey(idempotencyKeyHeader);
    return this.routeDeps.orderCompatibilityCommand.createChannelOrder({
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

  async createChannelFulfilledOrderV2(body, idempotencyKeyHeader, channelReferenceHeader) {
    await this.enforceMutationRateLimit();
    const actor = requireActorContext();
    const { actorId, actorKind } = commerceActorFields(actor);
    const idempotencyKey = requireIdempotencyKey(idempotencyKeyHeader);
    return this.routeDeps.orderCompatibilityCommand.createChannelFulfilledOrder({
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

  /**
   * @param {import('zod').infer<typeof import('../../modules/compatibility/presentation/compatibility-acknowledge.schemas.js').acknowledgeOrderBodySchema>} body
   * @param {string | string[] | undefined} idempotencyKeyHeader
   */
  async acknowledgeOrderV2(body, idempotencyKeyHeader) {
    await this.enforceMutationRateLimit();
    const actor = requireActorContext();
    const { actorId, actorKind } = commerceActorFields(actor);
    const idempotencyKey = requireIdempotencyKey(idempotencyKeyHeader);
    return this.routeDeps.orderCompatibilityCommand.acknowledgeOrder({
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
   * @param {{ page?: number, pageSize?: number }} query
   */
  async listCeOrders(query) {
    await this.enforceReadRateLimit();
    const actor = requireActorContext();
    return this.routeDeps.stockConnectCeOrderCompatibilityQuery.listOrdersForStockConnectPoll({
      tenantId: actor.tenantId,
      actorPermissions: actor.permissions,
      page: query.page,
      pageSize: query.pageSize,
    });
  }

  async getCeOrderInvoice(merchantOrderNo) {
    await this.enforceReadRateLimit();
    const actor = requireActorContext();
    return this.routeDeps.stockConnectCeOrderInvoiceQuery.getOrderInvoice({
      tenantId: actor.tenantId,
      actorPermissions: actor.permissions,
      merchantOrderNo,
    });
  }

  /**
   * @param {import('zod').infer<typeof import('../../modules/compatibility/presentation/compatibility-acknowledge.schemas.js').acknowledgeOrderBodySchema>} body
   * @param {string | string[] | undefined} idempotencyKeyHeader
   */
  async acknowledgeOrderCe(body, idempotencyKeyHeader) {
    await this.enforceMutationRateLimit();
    const actor = requireActorContext();
    const { actorId, actorKind } = commerceActorFields(actor);
    const routeId = 'POST /api/v2/ce/orders/acknowledge';
    const idempotencyKey = resolveStockConnectCeIdempotencyKey({
      header: idempotencyKeyHeader,
      tenantId: actor.tenantId,
      routeId,
      fingerprint: stableIdempotencyFingerprint(body),
    });
    return this.routeDeps.orderCompatibilityCommand.acknowledgeOrder({
      tenantId: actor.tenantId,
      actorId,
      actorKind,
      actorPermissions: actor.permissions,
      body,
      idempotencyKey,
      principalFingerprint: actorFingerprint(actor),
    });
  }
}
