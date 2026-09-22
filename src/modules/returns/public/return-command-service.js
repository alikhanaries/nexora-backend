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
 * @typedef {object} ReturnLineDecisionCommand
 * @property {string} merchantProductNo
 * @property {number} acceptedQuantity
 * @property {number} rejectedQuantity
 *
 * @typedef {object} AcknowledgeReturnCommand
 * @property {string} tenantId
 * @property {string} actorId
 * @property {'user'|'api-key'} actorKind
 * @property {readonly string[]} actorPermissions
 * @property {string} returnId
 * @property {string} [idempotencyKey]
 * @property {string} [principalFingerprint]
 * @property {string} [routeId]
 * @property {string} [requestFingerprint]
 * @property {object} [transaction]
 *
 * @typedef {object} AcknowledgeReturnResult
 * @property {ReturnDetailDto} return
 *
 * @typedef {object} ProcessReturnReceiveCommand
 * @property {string} tenantId
 * @property {string} actorId
 * @property {'user'|'api-key'} actorKind
 * @property {readonly string[]} actorPermissions
 * @property {string} returnId
 * @property {ReturnLineDecisionCommand[]} lineDecisions
 * @property {string} [idempotencyKey]
 * @property {string} [principalFingerprint]
 * @property {string} [routeId]
 * @property {string} [requestFingerprint]
 * @property {object} [transaction]
 *
 * @typedef {object} ProcessReturnReceiveResult
 * @property {ReturnDetailDto} return
 *
 * @typedef {object} ReturnCommandService
 * @property {(command: CreateReturnCommand) => Promise<CreateReturnResult>} createReturn
 * @property {(command: AcknowledgeReturnCommand) => Promise<AcknowledgeReturnResult>} acknowledgeReturn
 * @property {(command: ProcessReturnReceiveCommand) => Promise<ProcessReturnReceiveResult>} processReturnReceive
 */

export { DefaultReturnCommandService } from '../application/return-command-service.js';
