/**
 * Nest injectable for compatibility order list/create/acknowledge flows.
 * Applies compatibility rate limits then calls `CORE_SERVICES.compatibility.routeDeps` use cases.
 */
import { Inject, Injectable } from '@nestjs/common';
import { COMPATIBILITY_RATE_LIMIT_POLICIES } from '../../../../shared/auth/rate-limit-policies.js';
import { requireActorContext } from '../../../../shared/context/require-principal.js';
import { actorFingerprint } from '../../../../shared/http/actor-fingerprint.js';
import { requireIdempotencyKey } from '../../../../shared/idempotency/index.js';
import { enforceCompatibilityRateLimit } from '../../services/enforce-compatibility-rate-limit.js';
import {
  resolveCompatV2IdempotencyKey,
  stableIdempotencyFingerprint,
} from '../../services/resolve-compat-v2-idempotency-key.js';
import { commerceActorFields } from '../../../../app/common/commerce-actor.js';
import { CORE_SERVICES } from '../../../../app/di/core-services.tokens.js';

/** Order-specific compatibility adapter used by v2 and CE order controllers. */
@Injectable()
class CompatibilityOrdersService {
  /** @param {import('../../../../app/di/core-services.module.js').CoreServices} coreServices Wired CORE_SERVICES root. */
  constructor(@Inject(CORE_SERVICES) coreServices) {
    this.coreServices = coreServices;
  }

  /** Compatibility module facades (queries/commands, rate limiter, idempotency) for HTTP adapters. */
  get routeDeps() {
    return this.coreServices.compatibility.routeDeps;
  }

  /**
   * Applies compatibility read rate limit for the current actor (tenant + principal).
   * @returns {Promise<void>} Throws when limit exceeded; no data mutation.
   */
  async enforceReadRateLimit() {
    const actor = requireActorContext();
    await enforceCompatibilityRateLimit({
      rateLimiter: this.routeDeps.rateLimiter,
      actor,
      policy: COMPATIBILITY_RATE_LIMIT_POLICIES.read,
      category: 'read',
    });
  }

  /**
   * Applies compatibility mutation rate limit before write routeDeps calls.
   * @returns {Promise<void>}
   */
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
   * @param {import('zod').infer<typeof import('../../modules/compatibility/views/compatibility-order.schemas.js').listOrdersQuerySchema>} query
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
   * @param {import('zod').infer<typeof import('../../modules/compatibility/views/compatibility-order.schemas.js').listNewOrdersQuerySchema>} query
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
   * @param {import('zod').infer<typeof import('../../modules/compatibility/views/compatibility-channel-order.schemas.js').createIntegrationOrderBodySchema>} body
   * @param {string | string[] | undefined} idempotencyKeyHeader
   * @param {string | string[] | undefined} channelReferenceHeader
   */
  async createIntegrationOrderV2(body, idempotencyKeyHeader, channelReferenceHeader) {
    await this.enforceMutationRateLimit();
    const actor = requireActorContext();
    const { actorId, actorKind } = commerceActorFields(actor);
    const idempotencyKey = requireIdempotencyKey(idempotencyKeyHeader);
    return this.routeDeps.orderCompatibilityCommand.createIntegrationOrder({
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
   * POST `/api/v2/orders/channel-fulfilled` handler body — pre-fulfilled integration order create.
   * @param {object} body Channel order payload.
   * @param {string | string[] | undefined} idempotencyKeyHeader Required idempotency header.
   * @param {string | string[] | undefined} channelReferenceHeader Optional `x-channel-reference`.
   * @returns {Promise<object>} External order response; idempotent via order command + store.
   */
  async createIntegrationFulfilledOrderV2(body, idempotencyKeyHeader, channelReferenceHeader) {
    await this.enforceMutationRateLimit();
    const actor = requireActorContext();
    const { actorId, actorKind } = commerceActorFields(actor);
    const idempotencyKey = requireIdempotencyKey(idempotencyKeyHeader);
    return this.routeDeps.orderCompatibilityCommand.createIntegrationFulfilledOrder({
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
   * @param {import('zod').infer<typeof import('../../modules/compatibility/views/compatibility-acknowledge.schemas.js').acknowledgeOrderBodySchema>} body
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
    return this.routeDeps.compatV2OrderQuery.listOrdersForCompatV2Poll({
      tenantId: actor.tenantId,
      actorPermissions: actor.permissions,
      page: query.page,
      pageSize: query.pageSize,
    });
  }

  /**
   * Loads order metadata and returns generated PDF bytes for `/api/v2/ce/orders/:merchantOrderNo/invoice`.
   * @param {string} merchantOrderNo Tenant-scoped merchant order number.
   * @returns {Promise<{ contentType: string, body: Buffer }>} PDF stream payload; read-only, no idempotency.
   */
  async getCeOrderInvoice(merchantOrderNo) {
    await this.enforceReadRateLimit();
    const actor = requireActorContext();
    return this.routeDeps.compatV2OrderInvoiceQuery.getOrderInvoice({
      tenantId: actor.tenantId,
      actorPermissions: actor.permissions,
      merchantOrderNo,
    });
  }

  /**
   * @param {import('zod').infer<typeof import('../../modules/compatibility/views/compatibility-acknowledge.schemas.js').acknowledgeOrderBodySchema>} body
   * @param {string | string[] | undefined} idempotencyKeyHeader
   */
  async acknowledgeOrderCe(body, idempotencyKeyHeader) {
    await this.enforceMutationRateLimit();
    const actor = requireActorContext();
    const { actorId, actorKind } = commerceActorFields(actor);
    const routeId = 'POST /api/v2/ce/orders/acknowledge';
    const idempotencyKey = resolveCompatV2IdempotencyKey({
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
export { CompatibilityOrdersService };
