/**
 * Public command port for order mutations consumed by native API adapters,
 * compatibility adapters, jobs, and future integrations.
 *
 * Compatibility must depend on this contract — never on `create-order.js` or repositories.
 * `createOrder` supports native and future Channel-ingestion flows — not Merchant `POST /v2/orders` (which does not exist on the Merchant contract).
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
 * @property {(command: AcknowledgeOrderCommand) => Promise<AcknowledgeOrderResult>} acknowledgeOrder
 */

export { DefaultOrderCommandService } from '../application/order-command-service.js';
