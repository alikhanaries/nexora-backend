/**
 * Public command port for cancellation mutations consumed by native API adapters,
 * compatibility adapters, jobs, and future integrations.
 *
 * @typedef {object} CreateCancellationLineCommand
 * @property {string} orderLineId
 * @property {number} quantity
 *
 * @typedef {object} CreateCancellationCommand
 * @property {string} tenantId
 * @property {string} actorId
 * @property {'user'|'api-key'} actorKind
 * @property {readonly string[]} actorPermissions
 * @property {string} orderId
 * @property {CreateCancellationLineCommand[]} lines
 * @property {string|null} [reason]
 * @property {string|null} [externalReference]
 * Provider-neutral merchant/integration cancellation reference. Unique per tenant when set.
 * @property {string} [idempotencyKey]
 * @property {string} [principalFingerprint]
 * @property {string} [routeId]
 * @property {string} [requestFingerprint]
 * @property {object} [transaction]
 *
 * @typedef {object} CancellationDetailDto
 * @property {string} id
 * @property {string} tenantId
 * @property {string} orderId
 * @property {string|null} [externalReference]
 * @property {string} status
 * @property {string|null} reason
 * @property {object[]} lines
 *
 * @typedef {object} CreateCancellationResult
 * @property {CancellationDetailDto} cancellation
 *
 * @typedef {object} CancellationCommandService
 * @property {(command: CreateCancellationCommand) => Promise<CreateCancellationResult>} createCancellation
 */

export { DefaultCancellationCommandService } from '../application/cancellation-command-service.js';
