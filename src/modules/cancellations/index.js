/**
 * Order cancellations domain: command/query services and HTTP use cases tied to order fulfillment and inventory.
 * Re-exports cancellation entity helpers from `./models`.
 */
import { createDefaultAuthorizationService } from '../authorization/public/index.js';
import {
    createCreateCancellation,
    createGetCancellation,
    createListCancellations,
    createCancellationQueryService,
    createCancellationCommandService
} from './services/index.js';
import { createPostgresCancellationRepository } from './repositories/index.js';
/**
 * @param {object} deps
 * @param {import('../../infrastructure/postgres/postgres-database.js').PostgresDatabase} deps.database
 * @param {import('../orders/public/index.js').OrderQueryService} deps.orderQueryService
 * @param {import('../orders/public/index.js').OrderFulfillmentService} deps.orderFulfillmentService
 * @param {import('../inventory/public/index.js').DefaultInventoryService} deps.inventoryService
 * @param {import('../../shared/events/event-recorder.port.js').EventRecorderPort} deps.eventRecorder
 * @param {import('../../infrastructure/postgres/idempotency-service.js').PostgresIdempotencyService} deps.idempotency
 * @param {import('../external-id-mapping/public/index.js').ExternalIntegerIdMappingCommandService} deps.externalIntegerIdMappingCommandService
 * @param {import('../audit/public/index.js').AuditRecorder} [deps.auditRecorder]
 * @returns {{ cancellationCommandService: object, cancellationQueryService: object, useCases: object }}
 */
export function createCancellationsModule(deps) {
    const authorization = createDefaultAuthorizationService();
    const cancellations = createPostgresCancellationRepository();
    const cancellationQueryService = createCancellationQueryService({
        authorization,
        queryable: deps.database,
        cancellations
    });
    const lifecycleDeps = {
        authorization,
        database: deps.database,
        cancellations,
        orderQueryService: deps.orderQueryService,
        orderFulfillmentService: deps.orderFulfillmentService,
        inventoryService: deps.inventoryService,
        eventRecorder: deps.eventRecorder,
        idempotency: deps.idempotency,
        externalIntegerIdMappingCommandService: deps.externalIntegerIdMappingCommandService,
        ...(deps.auditRecorder === undefined ? {} : { auditRecorder: deps.auditRecorder })
    };
    const createCancellation = createCreateCancellation(lifecycleDeps);
    const cancellationCommandService = createCancellationCommandService({
        createCancellation,
        idempotency: deps.idempotency
    });
    const useCases = {
        createCancellation,
        getCancellation: createGetCancellation({ authorization, cancellationQueryService }),
        listCancellations: createListCancellations({
            authorization,
            queryable: deps.database,
            cancellations
        }),
        idempotency: deps.idempotency
    };
    return {
        cancellationCommandService,
        cancellationQueryService,
        useCases
    };
}
export {
    createCancellationEntity,
    reconstituteCancellation,
    createCancellationLineEntity,
    reconstituteCancellationLine,
    CancellationStatus,
} from './models/index.js';
