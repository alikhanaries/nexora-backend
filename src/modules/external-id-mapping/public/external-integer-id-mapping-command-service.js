/**
 * Public command port for external integer ID mapping.
 *
 * @typedef {object} AssignExternalIntegerIdMappingCommand
 * @property {string} tenantId
 * @property {string} provider
 * @property {string} resourceType
 * @property {string} resourceId
 *
 * @typedef {object} ExternalIntegerIdMappingDto
 * @property {string} id
 * @property {string} tenantId
 * @property {string} provider
 * @property {string} resourceType
 * @property {string} resourceId
 * @property {number} externalId
 * @property {Date} createdAt
 *
 * @typedef {object} AssignExternalIntegerIdMappingResult
 * @property {ExternalIntegerIdMappingDto} mapping
 *
 * @typedef {object} ExternalIntegerIdMappingCommandService
 * @property {(transaction: object, command: AssignExternalIntegerIdMappingCommand) => Promise<AssignExternalIntegerIdMappingResult>} assignMapping
 */

export { DefaultExternalIntegerIdMappingCommandService } from '../application/external-integer-id-mapping-command-service.js';
