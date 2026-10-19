import { DefaultAuthorizationService } from '../authorization/public/index.js';
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
    createReturnCommandService,
} from './services/index.js';
import { PostgresReturnRepository } from './repositories/index.js';
import returnRoutes, {} from './controllers/return.routes.js';
export function createReturnsModule(deps) {
    const authorization = new DefaultAuthorizationService();
    const returns = new PostgresReturnRepository();
    const returnQueryService = createReturnQueryService({
        authorization,
        queryable: deps.database,
        returns,
    });
    const lifecycleDeps = {
        authorization,
        database: deps.database,
        returns,
        orders: deps.orderReturnGateway,
        eventRecorder: deps.eventRecorder,
        idempotency: deps.idempotency,
        externalIntegerIdMappingCommandService: deps.externalIntegerIdMappingCommandService,
        ...(deps.auditRecorder === undefined ? {} : { auditRecorder: deps.auditRecorder }),
    };
    const createReturn = createCreateReturn(lifecycleDeps);
    const acknowledgeReturn = createAcknowledgeReturn(lifecycleDeps);
    const processReturnReceive = createProcessReturnReceive({
        ...lifecycleDeps,
        inventoryService: deps.inventoryService,
    });
    const returnCommandService = createReturnCommandService({
        createReturn,
        acknowledgeReturn,
        processReturnReceive,
        idempotency: deps.idempotency,
    });
    const useCases = {
        createReturn,
        getReturn: createGetReturn({ authorization, returnQueryService }),
        listReturns: createListReturns({
            authorization,
            queryable: deps.database,
            returns,
        }),
        acknowledgeReturn,
        approveReturn: createApproveReturn(lifecycleDeps),
        processReturnReceive,
        receiveReturn: createReceiveReturn({
            ...lifecycleDeps,
            inventoryService: deps.inventoryService,
        }),
        completeReturn: createCompleteReturn(lifecycleDeps),
        rejectReturn: createRejectReturn(lifecycleDeps),
        cancelReturn: createCancelReturn(lifecycleDeps),
        idempotency: deps.idempotency,
    };
    return {
        returnCommandService,
        returnQueryService,
        useCases,
        routes: returnRoutes,
    };
}
export { Return, ReturnLine, ReturnStatus } from './models/index.js';
