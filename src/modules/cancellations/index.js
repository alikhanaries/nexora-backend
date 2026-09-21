import { DefaultAuthorizationService } from '../authorization/public/index.js';
import { CreateCancellation, DefaultCancellationQueryService, GetCancellation, ListCancellations, } from './application/index.js';
import { PostgresCancellationRepository } from './infrastructure/index.js';
import cancellationRoutes, {} from './presentation/cancellation.routes.js';
export function createCancellationsModule(deps) {
    const authorization = new DefaultAuthorizationService();
    const cancellations = new PostgresCancellationRepository();
    const orders = deps.orders;
    const cancellationQueryService = new DefaultCancellationQueryService({
        queryable: deps.database,
        cancellations,
    });
    const lifecycleDeps = {
        authorization,
        database: deps.database,
        cancellations,
        orders,
        orderFulfillmentService: deps.orderFulfillmentService,
        inventoryService: deps.inventoryService,
        eventRecorder: deps.eventRecorder,
        ...(deps.auditRecorder === undefined ? {} : { auditRecorder: deps.auditRecorder }),
    };
    const useCases = {
        createCancellation: new CreateCancellation(lifecycleDeps),
        getCancellation: new GetCancellation({ authorization, cancellationQueryService }),
        listCancellations: new ListCancellations({
            authorization,
            queryable: deps.database,
            cancellations,
        }),
    };
    return {
        cancellationQueryService,
        useCases,
        routes: cancellationRoutes,
    };
}
export { Cancellation, CancellationLine, CancellationStatus } from './domain/index.js';
