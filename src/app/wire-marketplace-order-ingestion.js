/**
 * Re-exports worker wiring so `createApplication` can assemble marketplace order ingestion services.
 */
export { wireMarketplaceOrderIngestion } from '../workers/wire-marketplace-order-ingestion.js';
