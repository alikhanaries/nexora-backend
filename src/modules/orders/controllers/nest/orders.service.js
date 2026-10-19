import { Inject, Injectable } from '@nestjs/common';
import { toOrderDetailResponse, toOrderResponse } from '../../views/order.mapper.js';
import { requireActorContext } from '../../../../shared/context/require-principal.js';
import { actorFingerprint } from '../../../../shared/http/actor-fingerprint.js';
import { fingerprintRequest, requireIdempotencyKey } from '../../../../shared/idempotency/index.js';
import { commerceActorFields } from '../../../../app/common/commerce-actor.js';
import { CORE_SERVICES } from '../../../../app/di/core-services.tokens.js';

function mapAddressInput(address) {
  if (address === undefined || address === null) {
    return null;
  }
  return {
    line1: address.line1 ?? null,
    line2: address.line2 ?? null,
    city: address.city ?? null,
    region: address.region ?? null,
    postalCode: address.postalCode ?? null,
    countryCode: address.countryCode ?? null,
  };
}

function mapCustomerInput(customer) {
  return {
    ...(customer.externalCustomerReference === undefined
      ? {}
      : { externalCustomerReference: customer.externalCustomerReference ?? null }),
    ...(customer.firstName === undefined ? {} : { firstName: customer.firstName ?? null }),
    ...(customer.lastName === undefined ? {} : { lastName: customer.lastName ?? null }),
    ...(customer.email === undefined ? {} : { email: customer.email ?? null }),
    ...(customer.phone === undefined ? {} : { phone: customer.phone ?? null }),
    ...(customer.companyName === undefined ? {} : { companyName: customer.companyName ?? null }),
    ...(customer.billingAddress === undefined
      ? {}
      : { billingAddress: mapAddressInput(customer.billingAddress) }),
    ...(customer.shippingAddress === undefined
      ? {}
      : { shippingAddress: mapAddressInput(customer.shippingAddress) }),
    ...(customer.metadata === undefined ? {} : { metadata: customer.metadata }),
  };
}

export @Injectable()
class OrdersService {
  constructor(@Inject(CORE_SERVICES) coreServices) {
    this.coreServices = coreServices;
  }

  get useCases() {
    return this.coreServices.orders.useCases;
  }

  /**
   * @param {import('zod').infer<typeof import('../../modules/orders/views/order.schemas.js').createOrderBodySchema>} body
   * @param {string | string[] | undefined} idempotencyKeyHeader
   */
  async createOrder(body, idempotencyKeyHeader) {
    const actor = requireActorContext();
    const { actorId, actorKind } = commerceActorFields(actor);
    const idempotencyKey = requireIdempotencyKey(idempotencyKeyHeader);
    const outcome = await this.useCases.idempotency.execute(
      {
        tenantId: actor.tenantId,
        principalFingerprint: actorFingerprint(actor),
        routeId: 'POST /api/v1/orders',
        idempotencyKey,
      },
      fingerprintRequest(body),
      async (tx) => {
        const { order } = await this.useCases.createOrder.execute({
          tenantId: actor.tenantId,
          actorId,
          actorKind,
          actorPermissions: actor.permissions,
          channelId: body.channelId,
          currency: body.currency,
          lines: body.lines.map((line) => ({
            productId: line.productId,
            stockLocationId: line.stockLocationId,
            quantity: line.quantity,
            ...(line.offerId === undefined ? {} : { offerId: line.offerId ?? null }),
          })),
          ...(body.customer === undefined ? {} : { customer: mapCustomerInput(body.customer) }),
          ...(body.externalOrderReference === undefined
            ? {}
            : { externalOrderReference: body.externalOrderReference }),
          ...(body.discountMinor === undefined ? {} : { discountMinor: body.discountMinor }),
          ...(body.taxMinor === undefined ? {} : { taxMinor: body.taxMinor }),
          ...(body.shippingMinor === undefined ? {} : { shippingMinor: body.shippingMinor }),
          transaction: tx,
        });
        return {
          success: true,
          data: toOrderDetailResponse(order),
        };
      },
      (responseBody) => ({ statusCode: 201, body: responseBody }),
      { useTransaction: true },
    );
    return outcome.value;
  }

  /**
   * @param {import('zod').infer<typeof import('../../modules/orders/views/order.schemas.js').listOrdersQuerySchema>} query
   */
  async listOrders(query) {
    const actor = requireActorContext();
    const page = await this.useCases.listOrders.execute({
      tenantId: actor.tenantId,
      actorPermissions: actor.permissions,
      ...(query.limit === undefined ? {} : { limit: query.limit }),
      ...(query.cursor === undefined ? {} : { cursor: query.cursor }),
      ...(query.status === undefined ? {} : { status: query.status }),
      ...(query.channelId === undefined ? {} : { channelId: query.channelId }),
      ...(query.externalOrderReference === undefined
        ? {}
        : { externalOrderReference: query.externalOrderReference }),
      ...(query.orderNumber === undefined ? {} : { orderNumber: query.orderNumber }),
      ...(query.createdAfter === undefined ? {} : { createdAfter: new Date(query.createdAfter) }),
      ...(query.createdBefore === undefined ? {} : { createdBefore: new Date(query.createdBefore) }),
      ...(query.updatedAfter === undefined ? {} : { updatedAfter: new Date(query.updatedAfter) }),
      ...(query.updatedBefore === undefined ? {} : { updatedBefore: new Date(query.updatedBefore) }),
    });
    return {
      items: page.items.map(toOrderResponse),
      nextCursor: page.nextCursor,
      hasMore: page.hasMore,
    };
  }

  async getOrder(orderId) {
    const actor = requireActorContext();
    const { order } = await this.useCases.getOrder.execute({
      tenantId: actor.tenantId,
      actorPermissions: actor.permissions,
      orderId,
    });
    return toOrderDetailResponse(order);
  }

  async confirmOrder(orderId) {
    const actor = requireActorContext();
    const { actorId, actorKind } = commerceActorFields(actor);
    const { order } = await this.useCases.confirmOrder.execute({
      tenantId: actor.tenantId,
      actorId,
      actorKind,
      actorPermissions: actor.permissions,
      orderId,
    });
    return toOrderDetailResponse(order);
  }
}
