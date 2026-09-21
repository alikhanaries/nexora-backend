import type { AuditRecorder } from '../audit/public/index.js';
import { DefaultAuthorizationService } from '../authorization/public/index.js';
import type { InventoryService } from '../inventory/public/index.js';
import type { EventRecorder } from '../../shared/events/index.js';
import type { Queryable, TransactionManager } from '../../shared/persistence/index.js';
import {
  ApproveReturn,
  CancelReturn,
  CompleteReturn,
  CreateReturn,
  DefaultReturnQueryService,
  GetReturn,
  ListReturns,
  ReceiveReturn,
  RejectReturn,
} from './application/index.js';
import { PostgresReturnOrderGateway, PostgresReturnRepository } from './infrastructure/index.js';
import returnRoutes, { type ReturnRoutesDependencies } from './presentation/return.routes.js';
import type { ReturnQueryService } from './public/index.js';

export interface ReturnsModuleDependencies {
  readonly database: TransactionManager & Queryable;
  readonly inventoryService: InventoryService;
  readonly eventRecorder: EventRecorder;
  readonly auditRecorder?: AuditRecorder;
}

export interface ReturnsModule {
  readonly returnQueryService: ReturnQueryService;
  readonly useCases: ReturnRoutesDependencies;
  readonly routes: typeof returnRoutes;
}

export function createReturnsModule(deps: ReturnsModuleDependencies): ReturnsModule {
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

  const useCases: ReturnRoutesDependencies = {
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
export type { ReturnQueryService } from './public/index.js';
