/**
 * Public command port for order mutations consumed by native API adapters,
 * compatibility adapters, jobs, and future integrations.
 *
 * Compatibility must depend on this contract — never on `create-order.js` or repositories.
 * `createOrder` is the native direct-entry path. Channel ingestion uses `createChannelOrder`.
 *
 * @typedef {object} CreateOrderAddressCommand
 * @property {string|null} [line1]
 * @property {string|null} [line2]
 * @property {string|null} [city]
 * @property {string|null} [region]
 * @property {string|null} [postalCode]
 * @property {string|null} [countryCode]
 *
 * @typedef {object} CreateOrderCustomerCommand
 * @property {string|null} [externalCustomerReference]
 * @property {string|null} [firstName]
 * @property {string|null} [lastName]
 * @property {string|null} [email]
 * @property {string|null} [phone]
 * @property {string|null} [companyName]
 * @property {CreateOrderAddressCommand|null} [billingAddress]
 * @property {CreateOrderAddressCommand|null} [shippingAddress]
 * @property {Record<string, unknown>} [metadata]
 *
 * @typedef {object} CreateOrderLineCommand
 * @property {string} productId
 * @property {string} stockLocationId
 * @property {number} quantity
 * @property {string|null} [offerId]
 *
 * @typedef {object} CreateChannelOrderLineCommand
 * @property {string} stockLocationId
 * @property {number} quantity
 * @property {string} [merchantSku]
 * @property {string} [channelProductNo]
 * @property {string} [productId]
 * @property {string|null} [offerId]
 *
 * @typedef {object} CreateOrderCommand
 * @property {string} tenantId
 * @property {string} actorId
 * @property {'user'|'api-key'} actorKind
 * @property {readonly string[]} actorPermissions
 * @property {string} channelId
 * @property {string} currency
 * @property {CreateOrderLineCommand[]} lines
 * @property {CreateOrderCustomerCommand} [customer]
 * @property {string|null} [externalOrderReference]
 * @property {number} [discountMinor]
 * @property {number} [taxMinor]
 * @property {number} [shippingMinor]
 * @property {string} [idempotencyKey]
 * @property {string} [principalFingerprint]
 * @property {string} [routeId]
 * @property {string} [requestFingerprint]
 * @property {object} [transaction]
 *
 * @typedef {object} CreateChannelOrderCommand
 * @property {string} tenantId
 * @property {string} actorId
 * @property {'user'|'api-key'} actorKind
 * @property {readonly string[]} actorPermissions
 * @property {string} channelId
 * @property {string} externalOrderReference
 * @property {string} currency
 * @property {CreateChannelOrderLineCommand[]} lines
 * @property {CreateOrderCustomerCommand} [customer]
 * @property {number} [discountMinor]
 * @property {number} [taxMinor]
 * @property {number} [shippingMinor]
 * @property {string} [idempotencyKey]
 * @property {string} [principalFingerprint]
 * @property {string} [routeId]
 * @property {string} [requestFingerprint]
 * @property {object} [transaction]
 *
 * @typedef {object} OrderDetailDto
 * @property {string} id
 * @property {string} tenantId
 * @property {string} channelId
 * @property {string|null} externalOrderReference
 * @property {string} orderNumber
 * @property {string} status
 * @property {string} currency
 * @property {number} subtotalMinor
 * @property {number} discountMinor
 * @property {number} taxMinor
 * @property {number} shippingMinor
 * @property {number} totalMinor
 * @property {Date} createdAt
 * @property {Date} updatedAt
 * @property {Date|null} confirmedAt
 * @property {Date|null} cancelledAt
 * @property {Date|null} shippedAt
 * @property {Date|null} deliveredAt
 * @property {object[]} lines
 * @property {object} customer
 *
 * @typedef {object} CreateOrderResult
 * @property {OrderDetailDto} order
 *
 * @typedef {object} CreateChannelOrderResult
 * @property {OrderDetailDto} order
 *
 * @typedef {object} ChannelFulfilledShipmentCommand
 * @property {string|null} [externalReference]
 * @property {string|null} [carrier]
 * @property {string|null} [service]
 * @property {string|null} [trackingNumber]
 *
 * @typedef {object} CreateChannelFulfilledOrderCommand
 * @property {string} tenantId
 * @property {string} actorId
 * @property {'user'|'api-key'} actorKind
 * @property {readonly string[]} actorPermissions
 * @property {string} channelId
 * @property {string} externalOrderReference
 * @property {string} currency
 * @property {CreateChannelOrderLineCommand[]} lines
 * @property {CreateOrderCustomerCommand} [customer]
 * @property {number} [discountMinor]
 * @property {number} [taxMinor]
 * @property {number} [shippingMinor]
 * @property {ChannelFulfilledShipmentCommand} [shipment]
 * @property {string} [idempotencyKey]
 * @property {string} [principalFingerprint]
 * @property {string} [routeId]
 * @property {string} [requestFingerprint]
 * @property {object} [transaction]
 *
 * @typedef {object} CreateChannelFulfilledOrderResult
 * @property {OrderDetailDto} order
 * @property {object|null} shipment
 *
 * @typedef {object} AcknowledgeOrderCommand
 * @property {string} tenantId
 * @property {string} actorId
 * @property {'user'|'api-key'} actorKind
 * @property {readonly string[]} actorPermissions
 * @property {string} orderNumber Merchant order number in Nexora (`orders.order_number`).
 * @property {string} [idempotencyKey]
 * @property {string} [principalFingerprint]
 * @property {string} [routeId]
 * @property {string} [requestFingerprint]
 * @property {object} [transaction]
 *
 * @typedef {object} AcknowledgeOrderResult
 * @property {OrderDetailDto} order
 *
 * @typedef {object} OrderCommandService
 * @property {(command: CreateOrderCommand) => Promise<CreateOrderResult>} createOrder
 * Native order entry — creates `CONFIRMED` orders and emits `order.created` + `order.confirmed`.
 * @property {(command: CreateChannelOrderCommand) => Promise<CreateChannelOrderResult>} createChannelOrder
 * Channel ingestion — creates `NEW` orders, reserves inventory, emits `order.created` only.
 * @property {(command: CreateChannelFulfilledOrderCommand) => Promise<CreateChannelFulfilledOrderResult>} createChannelFulfilledOrder
 * Channel-fulfilled ingestion — creates `CONFIRMED` orders, auto-ships, no inventory reservation.
 * @property {(command: AcknowledgeOrderCommand) => Promise<AcknowledgeOrderResult>} acknowledgeOrder
 */

export { DefaultOrderCommandService } from '../application/order-command-service.js';
