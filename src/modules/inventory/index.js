import { DefaultAuthorizationService } from '../authorization/public/index.js';
import { AdjustInventory, CreateStockLocation, GetInventory, GetStockLocation, ListStockLocations, ReceiveInventory, ReleaseInventory, ReserveInventory, } from './application/index.js';
import { DefaultInventoryService } from './application/default-inventory-service.js';
import { PostgresInventoryRepository, PostgresStockLocationRepository, } from './infrastructure/index.js';
import inventoryRoutes, {} from './presentation/inventory.routes.js';
export function createInventoryModule(deps) {
    const stockLocationRepository = new PostgresStockLocationRepository();
    const inventoryRepository = new PostgresInventoryRepository();
    const authorization = new DefaultAuthorizationService();
    const inventoryService = new DefaultInventoryService({
        transactionManager: deps.transactionManager,
        queryable: deps.queryable,
        inventoryRepository,
        stockLocationRepository,
        productQueryService: deps.productQueryService,
        eventRecorder: deps.eventRecorder,
        ...(deps.auditRecorder === undefined ? {} : { auditRecorder: deps.auditRecorder }),
    });
    const useCases = {
        createStockLocation: new CreateStockLocation({
            transactionManager: deps.transactionManager,
            stockLocations: stockLocationRepository,
            authorization,
            ...(deps.auditRecorder === undefined ? {} : { auditRecorder: deps.auditRecorder }),
        }),
        listStockLocations: new ListStockLocations({
            queryable: deps.queryable,
            stockLocations: stockLocationRepository,
            authorization,
        }),
        getStockLocation: new GetStockLocation({
            queryable: deps.queryable,
            stockLocations: stockLocationRepository,
            authorization,
        }),
        getInventory: new GetInventory({
            queryable: deps.queryable,
            inventoryRepository,
            authorization,
        }),
        adjustInventory: new AdjustInventory({ inventoryService, authorization }),
        receiveInventory: new ReceiveInventory({ inventoryService, authorization }),
        reserveInventory: new ReserveInventory({ inventoryService, authorization }),
        releaseInventory: new ReleaseInventory({ inventoryService, authorization }),
    };
    return {
        inventoryService,
        useCases,
        routes: inventoryRoutes,
    };
}
export { DefaultInventoryService } from './public/index.js';
