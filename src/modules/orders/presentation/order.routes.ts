import type { FastifyPluginAsync } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { requireActorContext } from '../../../shared/context/require-principal.js';
import { ValidationError } from '../../../shared/errors/index.js';
import { actorFingerprint } from '../../../shared/http/actor-fingerprint.js';
import { fingerprintRequest, type IdempotencyService } from '../../../shared/idempotency/index.js';
import type { z } from 'zod';
import type { AddressSnapshot } from '../domain/customer-snapshot.js';
import type { ConfirmOrder } from '../application/confirm-order.js';
import type { CreateOrder, CreateOrderCustomerInput } from '../application/create-order.js';
import type { GetOrder } from '../application/get-order.js';
import type { ListOrders } from '../application/list-orders.js';
import { toOrderDetailResponse, toOrderResponse } from './order.mapper.js';
import {
  createOrderBodySchema,
  listOrdersQuerySchema,
  orderIdParamsSchema,
  orderListSuccessResponseSchema,
  orderSuccessResponseSchema,
} from './order.schemas.js';

export interface OrderRoutesDependencies {
  readonly createOrder: CreateOrder;
  readonly confirmOrder: ConfirmOrder;
  readonly getOrder: GetOrder;
  readonly listOrders: ListOrders;
  readonly idempotency: IdempotencyService;
}

type CreateOrderBody = z.infer<typeof createOrderBodySchema>;

function mapAddressInput(
  address: NonNullable<CreateOrderBody['customer']>['billingAddress'],
): AddressSnapshot | null {
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

function mapCustomerInput(
  customer: NonNullable<CreateOrderBody['customer']>,
): CreateOrderCustomerInput {
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

function requireIdempotencyKey(header: string | string[] | undefined): string {
  const value = Array.isArray(header) ? header[0] : header;
  if (value === undefined || value.trim().length === 0) {
    throw new ValidationError('Idempotency-Key header is required');
  }
  return value.trim();
}

const orderRoutes: FastifyPluginAsync<OrderRoutesDependencies> = async (app, deps) => {
  const typed = app.withTypeProvider<ZodTypeProvider>();

  typed.post(
    '/api/v1/orders',
    {
      schema: {
        tags: ['Orders'],
        summary: 'Create an order',
        body: createOrderBodySchema,
        response: {
          201: orderSuccessResponseSchema,
        },
      },
    },
    async (request, reply) => {
      const actor = requireActorContext();
      const actorId = actor.userId ?? actor.apiKeyId ?? actor.tenantId;
      const actorKind = actor.userId !== undefined ? ('user' as const) : ('api-key' as const);
      const idempotencyKey = requireIdempotencyKey(request.headers['idempotency-key']);

      const outcome = await deps.idempotency.execute(
        {
          tenantId: actor.tenantId,
          principalFingerprint: actorFingerprint(actor),
          routeId: 'POST /api/v1/orders',
          idempotencyKey,
        },
        fingerprintRequest(request.body),
        async () => {
          const { order } = await deps.createOrder.execute({
            tenantId: actor.tenantId,
            actorId,
            actorKind,
            actorPermissions: actor.permissions,
            channelId: request.body.channelId,
            currency: request.body.currency,
            lines: request.body.lines.map((line) => ({
              productId: line.productId,
              stockLocationId: line.stockLocationId,
              quantity: line.quantity,
              ...(line.offerId === undefined ? {} : { offerId: line.offerId ?? null }),
            })),
            ...(request.body.customer === undefined
              ? {}
              : { customer: mapCustomerInput(request.body.customer) }),
            ...(request.body.externalOrderReference === undefined
              ? {}
              : { externalOrderReference: request.body.externalOrderReference }),
            ...(request.body.discountMinor === undefined
              ? {}
              : { discountMinor: request.body.discountMinor }),
            ...(request.body.taxMinor === undefined ? {} : { taxMinor: request.body.taxMinor }),
            ...(request.body.shippingMinor === undefined
              ? {}
              : { shippingMinor: request.body.shippingMinor }),
          });
          return {
            success: true as const,
            data: toOrderDetailResponse(order),
          };
        },
        (body) => ({ statusCode: 201, body }),
      );

      void reply.status(201);
      return outcome.value;
    },
  );

  typed.get(
    '/api/v1/orders',
    {
      schema: {
        tags: ['Orders'],
        summary: 'List orders',
        querystring: listOrdersQuerySchema,
        response: {
          200: orderListSuccessResponseSchema,
        },
      },
    },
    async (request) => {
      const actor = requireActorContext();
      const page = await deps.listOrders.execute({
        tenantId: actor.tenantId,
        actorPermissions: actor.permissions,
        ...(request.query.limit === undefined ? {} : { limit: request.query.limit }),
        ...(request.query.cursor === undefined ? {} : { cursor: request.query.cursor }),
        ...(request.query.status === undefined ? {} : { status: request.query.status }),
        ...(request.query.channelId === undefined ? {} : { channelId: request.query.channelId }),
        ...(request.query.externalOrderReference === undefined
          ? {}
          : { externalOrderReference: request.query.externalOrderReference }),
        ...(request.query.orderNumber === undefined
          ? {}
          : { orderNumber: request.query.orderNumber }),
        ...(request.query.createdAfter === undefined
          ? {}
          : { createdAfter: new Date(request.query.createdAfter) }),
        ...(request.query.createdBefore === undefined
          ? {}
          : { createdBefore: new Date(request.query.createdBefore) }),
      });

      return {
        success: true as const,
        data: {
          items: page.items.map(toOrderResponse),
          nextCursor: page.nextCursor,
          hasMore: page.hasMore,
        },
      };
    },
  );

  typed.get(
    '/api/v1/orders/:orderId',
    {
      schema: {
        tags: ['Orders'],
        summary: 'Get an order by id',
        params: orderIdParamsSchema,
        response: {
          200: orderSuccessResponseSchema,
        },
      },
    },
    async (request) => {
      const actor = requireActorContext();
      const { order } = await deps.getOrder.execute({
        tenantId: actor.tenantId,
        actorPermissions: actor.permissions,
        orderId: request.params.orderId,
      });

      return {
        success: true as const,
        data: toOrderDetailResponse(order),
      };
    },
  );

  typed.post(
    '/api/v1/orders/:orderId/confirm',
    {
      schema: {
        tags: ['Orders'],
        summary: 'Confirm an order',
        params: orderIdParamsSchema,
        response: {
          200: orderSuccessResponseSchema,
        },
      },
    },
    async (request) => {
      const actor = requireActorContext();
      const actorId = actor.userId ?? actor.apiKeyId ?? actor.tenantId;
      const actorKind = actor.userId !== undefined ? ('user' as const) : ('api-key' as const);

      const { order } = await deps.confirmOrder.execute({
        tenantId: actor.tenantId,
        actorId,
        actorKind,
        actorPermissions: actor.permissions,
        orderId: request.params.orderId,
      });

      return {
        success: true as const,
        data: toOrderDetailResponse(order),
      };
    },
  );

  await Promise.resolve();
};

export default orderRoutes;
