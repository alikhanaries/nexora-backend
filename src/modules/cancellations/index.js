import { createDefaultAuthorizationService } from '../authorization/public/index.js';
import {
    createCreateCancellation,
    createGetCancellation,
    createListCancellations,
    createCancellationQueryService,
    createCancellationCommandService
} from './services/index.js';
import { createPostgresCancellationRepository } from './repositories/index.js';
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
