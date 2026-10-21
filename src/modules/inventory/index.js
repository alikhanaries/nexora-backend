import { createDefaultAuthorizationService } from '../authorization/public/index.js';
import {
    createAdjustInventory,
    createCreateStockLocation,
    createDefaultInventoryService,
    createGetInventory,
    createGetStockLocation,
    createListStockLocations,
    createReceiveInventory,
    createReleaseInventory,
    createReserveInventory,
} from './services/index.js';
import { createPostgresInventoryRepository, createPostgresStockLocationRepository } from './repositories/index.js';

export function createInventoryModule(deps) {
    const stockLocationRepository = createPostgresStockLocationRepository();
    const inventoryRepository = createPostgresInventoryRepository();
    const authorization = createDefaultAuthorizationService();
    const inventoryService = createDefaultInventoryService({
        transactionManager: deps.transactionManager,
        queryable: deps.queryable,
        inventoryRepository,
        stockLocationRepository,
        productQueryService: deps.productQueryService,
        eventRecorder: deps.eventRecorder,
        ...(deps.auditRecorder === undefined ? {} : { auditRecorder: deps.auditRecorder })
    });
    const useCases = {
        createStockLocation: createCreateStockLocation({
            transactionManager: deps.transactionManager,
            stockLocations: stockLocationRepository,
            authorization,
            ...(deps.auditRecorder === undefined ? {} : { auditRecorder: deps.auditRecorder })
        }),
        listStockLocations: createListStockLocations({
            queryable: deps.queryable,
            stockLocations: stockLocationRepository,
            authorization
        }),
        getStockLocation: createGetStockLocation({
            queryable: deps.queryable,
            stockLocations: stockLocationRepository,
            authorization
        }),
        getInventory: createGetInventory({
            queryable: deps.queryable,
            inventoryRepository,
            authorization
        }),
        adjustInventory: createAdjustInventory({ inventoryService, authorization }),
        receiveInventory: createReceiveInventory({ inventoryService, authorization }),
        reserveInventory: createReserveInventory({ inventoryService, authorization }),
        releaseInventory: createReleaseInventory({ inventoryService, authorization })
    };
    return {
        inventoryService,
        useCases
    };
}

export { createDefaultInventoryService } from './public/index.js';
