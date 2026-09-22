/**
 * Public command port for return mutations consumed by native API adapters,
 * compatibility adapters, jobs, and future integrations.
 *
 * @typedef {object} CreateReturnLineCommand
 * @property {string} orderLineId
 * @property {number} quantity
 * @property {string|null} [reason]
 *
 * @typedef {object} CreateReturnCommand
 * @property {string} tenantId
 * @property {string} actorId
 * @property {'user'|'api-key'} actorKind
 * @property {readonly string[]} actorPermissions
 * @property {string} orderId
 * @property {CreateReturnLineCommand[]} lines
 * @property {string|null} [reason]
 * @property {string|null} [shipmentId]
 * @property {string|null} [externalReference]
 * Provider-neutral merchant/integration return reference. Unique per tenant when set.
 * @property {string} [idempotencyKey]
 * @property {string} [principalFingerprint]
 * @property {string} [routeId]
 * @property {string} [requestFingerprint]
 * @property {object} [transaction]
 *
 * @typedef {object} ReturnDetailDto
 * @property {string} id
 * @property {string} tenantId
 * @property {string} orderId
 * @property {string|null} [externalReference]
 * @property {string|null} shipmentId
 * @property {string} status
 * @property {string|null} reason
 * @property {object[]} lines
 *
 * @typedef {object} CreateReturnResult
 * @property {ReturnDetailDto} return
 *
 * @typedef {object} ReturnCommandService
 * @property {(command: CreateReturnCommand) => Promise<CreateReturnResult>} createReturn
 */

export { DefaultReturnCommandService } from '../application/return-command-service.js';
