/**
 * Public command port for shipment mutations consumed by native API adapters,
 * compatibility adapters, jobs, and future integrations.
 *
 * @typedef {object} CreateShipmentLineCommand
 * @property {string} orderLineId
 * @property {number} quantity
 *
 * @typedef {object} CreateShipmentCommand
 * @property {string} tenantId
 * @property {string} actorId
 * @property {'user'|'api-key'} actorKind
 * @property {readonly string[]} actorPermissions
 * @property {string} orderId
 * @property {CreateShipmentLineCommand[]} lines
 * @property {string|null} [carrier]
 * @property {string|null} [service]
 * @property {string|null} [trackingNumber]
 * @property {string|null} [externalReference]
 * Provider-neutral merchant/integration shipment reference. Unique per tenant when set.
 * @property {string} [idempotencyKey]
 * @property {string} [principalFingerprint]
 * @property {string} [routeId]
 * @property {string} [requestFingerprint]
 * @property {object} [transaction]
 *
 * @typedef {object} ShipmentDetailDto
 * @property {string} id
 * @property {string} tenantId
 * @property {string} orderId
 * @property {string|null} [externalReference]
 * @property {string|null} carrier
 * @property {string|null} service
 * @property {string|null} trackingNumber
 * @property {string} status
 * @property {object[]} lines
 *
 * @typedef {object} CreateShipmentResult
 * @property {ShipmentDetailDto} shipment
 *
 * @typedef {object} UpdateShipmentTrackingCommand
 * @property {string} tenantId
 * @property {string} actorId
 * @property {'user'|'api-key'} actorKind
 * @property {readonly string[]} actorPermissions
 * @property {string} externalReference
 * @property {string|null} carrier
 * @property {string|null} trackingNumber
 * @property {string} [idempotencyKey]
 * @property {string} [principalFingerprint]
 * @property {string} [routeId]
 * @property {string} [requestFingerprint]
 * @property {object} [transaction]
 *
 * @typedef {object} UpdateShipmentTrackingResult
 * @property {ShipmentDetailDto} shipment
 *
 * @typedef {object} ShipmentCommandService
 * @property {(command: CreateShipmentCommand) => Promise<CreateShipmentResult>} createShipment
 * @property {(command: UpdateShipmentTrackingCommand) => Promise<UpdateShipmentTrackingResult>} updateShipmentTracking
 */

export { DefaultShipmentCommandService } from '../application/shipment-command-service.js';
