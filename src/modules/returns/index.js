import { DefaultAuthorizationService } from '../authorization/public/index.js';
import { AcknowledgeReturn, ApproveReturn, CancelReturn, CompleteReturn, CreateReturn, DefaultReturnQueryService, GetReturn, ListReturns, ProcessReturnReceive, ReceiveReturn, RejectReturn, } from './application/index.js';
import { DefaultReturnCommandService } from './public/return-command-service.js';
import { PostgresReturnRepository } from './infrastructure/index.js';
import returnRoutes, {} from './presentation/return.routes.js';
export function createReturnsModule(deps) {
    const authorization = new DefaultAuthorizationService();
    const returns = new PostgresReturnRepository();
    const returnQueryService = new DefaultReturnQueryService({
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
    const createReturn = new CreateReturn(lifecycleDeps);
    const acknowledgeReturn = new AcknowledgeReturn(lifecycleDeps);
    const processReturnReceive = new ProcessReturnReceive({
        ...lifecycleDeps,
        inventoryService: deps.inventoryService,
    });
    const returnCommandService = new DefaultReturnCommandService({
        createReturn,
        acknowledgeReturn,
        processReturnReceive,
        idempotency: deps.idempotency,
    });
    const useCases = {
        createReturn,
        getReturn: new GetReturn({ authorization, returnQueryService }),
        listReturns: new ListReturns({
            authorization,
            queryable: deps.database,
            returns,
        }),
        acknowledgeReturn,
        approveReturn: new ApproveReturn(lifecycleDeps),
        processReturnReceive,
        receiveReturn: new ReceiveReturn({
            ...lifecycleDeps,
            inventoryService: deps.inventoryService,
        }),
        completeReturn: new CompleteReturn(lifecycleDeps),
        rejectReturn: new RejectReturn(lifecycleDeps),
        cancelReturn: new CancelReturn(lifecycleDeps),
        idempotency: deps.idempotency,
    };
    return {
        returnCommandService,
        returnQueryService,
        useCases,
        routes: returnRoutes,
    };
}
export { Return, ReturnLine, ReturnStatus } from './domain/index.js';
