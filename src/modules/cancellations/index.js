import { DefaultAuthorizationService } from '../authorization/public/index.js';
import {
    createCreateCancellation,
    createGetCancellation,
    createListCancellations,
    createCancellationQueryService,
    createCancellationCommandService,
} from './services/index.js';
import { PostgresCancellationRepository } from './repositories/index.js';
import cancellationRoutes, {} from './controllers/cancellation.routes.js';
export function createCancellationsModule(deps) {
    const authorization = new DefaultAuthorizationService();
    const cancellations = new PostgresCancellationRepository();
    const cancellationQueryService = createCancellationQueryService({
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
        externalIntegerIdMappingCommandService: deps.externalIntegerIdMappingCommandService,
        ...(deps.auditRecorder === undefined ? {} : { auditRecorder: deps.auditRecorder }),
    };
    const createCancellation = createCreateCancellation(lifecycleDeps);
    const cancellationCommandService = createCancellationCommandService({
        createCancellation,
        idempotency: deps.idempotency,
    });
    const useCases = {
        createCancellation,
        getCancellation: createGetCancellation({ authorization, cancellationQueryService }),
        listCancellations: createListCancellations({
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
export { Cancellation, CancellationLine, CancellationStatus } from './models/index.js';
