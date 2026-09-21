import type { AuditRecorder } from '../audit/public/index.js';
import { DefaultAuthorizationService } from '../authorization/public/index.js';
import type { InventoryService } from '../inventory/public/index.js';
import type { OrderFulfillmentService } from '../orders/public/index.js';
import type { OrderRepository } from '../orders/public/index.js';
import type { EventRecorder } from '../../shared/events/index.js';
import type { Queryable, TransactionManager } from '../../shared/persistence/index.js';
import {
  CreateCancellation,
  DefaultCancellationQueryService,
  GetCancellation,
  ListCancellations,
} from './application/index.js';
import { PostgresCancellationRepository } from './infrastructure/index.js';
import cancellationRoutes, {
  type CancellationRoutesDependencies,
} from './presentation/cancellation.routes.js';
import type { CancellationQueryService } from './public/index.js';

export interface CancellationsModuleDependencies {
  readonly database: TransactionManager & Queryable;
  readonly orders: OrderRepository;
  readonly orderFulfillmentService: OrderFulfillmentService;
  readonly inventoryService: InventoryService;
  readonly eventRecorder: EventRecorder;
  readonly auditRecorder?: AuditRecorder;
}

export interface CancellationsModule {
  readonly cancellationQueryService: CancellationQueryService;
  readonly useCases: CancellationRoutesDependencies;
  readonly routes: typeof cancellationRoutes;
}

export function createCancellationsModule(
  deps: CancellationsModuleDependencies,
): CancellationsModule {
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

  const useCases: CancellationRoutesDependencies = {
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
export type { CancellationQueryService } from './public/index.js';
