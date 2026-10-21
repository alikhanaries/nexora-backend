/**
 * Returns domain: RMA lifecycle, command/query services, and inventory-aware receive flows.
 * Re-exports return entity helpers from `./models`.
 */
import { createDefaultAuthorizationService } from '../authorization/public/index.js';
import {
    createAcknowledgeReturn,
    createApproveReturn,
    createCancelReturn,
    createCompleteReturn,
    createCreateReturn,
    createGetReturn,
    createListReturns,
    createProcessReturnReceive,
    createReceiveReturn,
    createRejectReturn,
    createReturnQueryService,
    createReturnCommandService
} from './services/index.js';
import { createPostgresReturnRepository } from './repositories/index.js';
/**
 * @param {object} deps
 * @param {import('../../infrastructure/postgres/postgres-database.js').PostgresDatabase} deps.database
 * @param {object} deps.orderReturnGateway
 * @param {import('../../shared/events/event-recorder.port.js').EventRecorderPort} deps.eventRecorder
 * @param {import('../../infrastructure/postgres/idempotency-service.js').PostgresIdempotencyService} deps.idempotency
 * @param {import('../inventory/public/index.js').DefaultInventoryService} deps.inventoryService
 * @param {import('../external-id-mapping/public/index.js').ExternalIntegerIdMappingCommandService} deps.externalIntegerIdMappingCommandService
 * @param {import('../audit/public/index.js').AuditRecorder} [deps.auditRecorder]
 * @returns {{ returnCommandService: object, returnQueryService: object, useCases: object }}
 */
export function createReturnsModule(deps) {
    const authorization = createDefaultAuthorizationService();
    const returns = createPostgresReturnRepository();
    const returnQueryService = createReturnQueryService({
        authorization,
        queryable: deps.database,
        returns
    });
    const lifecycleDeps = {
        authorization,
        database: deps.database,
        returns,
        orders: deps.orderReturnGateway,
        eventRecorder: deps.eventRecorder,
        idempotency: deps.idempotency,
        externalIntegerIdMappingCommandService: deps.externalIntegerIdMappingCommandService,
        ...(deps.auditRecorder === undefined ? {} : { auditRecorder: deps.auditRecorder })
    };
    const createReturn = createCreateReturn(lifecycleDeps);
    const acknowledgeReturn = createAcknowledgeReturn(lifecycleDeps);
    const processReturnReceive = createProcessReturnReceive({
        ...lifecycleDeps,
        inventoryService: deps.inventoryService
    });
    const returnCommandService = createReturnCommandService({
        createReturn,
        acknowledgeReturn,
        processReturnReceive,
        idempotency: deps.idempotency
    });
    const useCases = {
        createReturn,
        getReturn: createGetReturn({ authorization, returnQueryService }),
        listReturns: createListReturns({
            authorization,
            queryable: deps.database,
            returns
        }),
        acknowledgeReturn,
        approveReturn: createApproveReturn(lifecycleDeps),
        processReturnReceive,
        receiveReturn: createReceiveReturn({
            ...lifecycleDeps,
            inventoryService: deps.inventoryService
        }),
        completeReturn: createCompleteReturn(lifecycleDeps),
        rejectReturn: createRejectReturn(lifecycleDeps),
        cancelReturn: createCancelReturn(lifecycleDeps),
        idempotency: deps.idempotency
    };
    return {
        returnCommandService,
        returnQueryService,
        useCases
    };
}
export {
    createReturnEntity,
    reconstituteReturn,
    createReturnLineEntity,
    reconstituteReturnLine,
    ReturnStatus,
} from './models/index.js';
