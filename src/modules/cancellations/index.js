import { DefaultAuthorizationService } from '../authorization/public/index.js';
import { CreateCancellation, DefaultCancellationQueryService, GetCancellation, ListCancellations, } from './application/index.js';
import { DefaultCancellationCommandService } from './public/cancellation-command-service.js';
import { PostgresCancellationRepository } from './infrastructure/index.js';
import cancellationRoutes, {} from './presentation/cancellation.routes.js';
export function createCancellationsModule(deps) {
    const authorization = new DefaultAuthorizationService();
    const cancellations = new PostgresCancellationRepository();
    const cancellationQueryService = new DefaultCancellationQueryService({
        authorization,
        queryable: deps.database,
        cancellations,
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
        ...(deps.auditRecorder === undefined ? {} : { auditRecorder: deps.auditRecorder }),
    };
    const createCancellation = new CreateCancellation(lifecycleDeps);
    const cancellationCommandService = new DefaultCancellationCommandService({
        createCancellation,
        idempotency: deps.idempotency,
    });
    const useCases = {
        createCancellation,
        getCancellation: new GetCancellation({ authorization, cancellationQueryService }),
        listCancellations: new ListCancellations({
            authorization,
            queryable: deps.database,
            cancellations,
        }),
        idempotency: deps.idempotency,
    };
    return {
        cancellationCommandService,
        cancellationQueryService,
        useCases,
        routes: cancellationRoutes,
    };
}
export { Cancellation, CancellationLine, CancellationStatus } from './domain/index.js';
