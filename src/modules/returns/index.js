import { DefaultAuthorizationService } from '../authorization/public/index.js';
import { ApproveReturn, CancelReturn, CompleteReturn, CreateReturn, DefaultReturnQueryService, GetReturn, ListReturns, ReceiveReturn, RejectReturn, } from './application/index.js';
import { PostgresReturnOrderGateway, PostgresReturnRepository } from './infrastructure/index.js';
import returnRoutes, {} from './presentation/return.routes.js';
export function createReturnsModule(deps) {
    const authorization = new DefaultAuthorizationService();
    const returns = new PostgresReturnRepository();
    const orders = new PostgresReturnOrderGateway();
    const returnQueryService = new DefaultReturnQueryService({
        queryable: deps.database,
        returns,
    });
    const lifecycleDeps = {
        authorization,
        database: deps.database,
        returns,
        orders,
        eventRecorder: deps.eventRecorder,
        ...(deps.auditRecorder === undefined ? {} : { auditRecorder: deps.auditRecorder }),
    };
    const useCases = {
        createReturn: new CreateReturn(lifecycleDeps),
        getReturn: new GetReturn({ authorization, returnQueryService }),
        listReturns: new ListReturns({
            authorization,
            queryable: deps.database,
            returns,
        }),
        approveReturn: new ApproveReturn(lifecycleDeps),
        receiveReturn: new ReceiveReturn({
            ...lifecycleDeps,
            inventoryService: deps.inventoryService,
        }),
        completeReturn: new CompleteReturn(lifecycleDeps),
        rejectReturn: new RejectReturn(lifecycleDeps),
        cancelReturn: new CancelReturn(lifecycleDeps),
    };
    return {
        returnQueryService,
        useCases,
        routes: returnRoutes,
    };
}
export { Return, ReturnLine, ReturnStatus } from './domain/index.js';
