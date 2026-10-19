import { describe, expect, it } from 'vitest';
import {
  MarketplaceIntegrationEntityType,
  isMarketplaceIntegrationEntityType,
} from '../../../src/modules/marketplaces/models/marketplace-integration-entity-type.js';

describe('marketplace-integration-entity-type', () => {
  it('accepts product, offer, and stock_location', () => {
    expect(isMarketplaceIntegrationEntityType(MarketplaceIntegrationEntityType.PRODUCT)).toBe(true);
    expect(isMarketplaceIntegrationEntityType(MarketplaceIntegrationEntityType.OFFER)).toBe(true);
    expect(isMarketplaceIntegrationEntityType(MarketplaceIntegrationEntityType.STOCK_LOCATION)).toBe(true);
  });

  it('rejects unknown types', () => {
    expect(isMarketplaceIntegrationEntityType('channel')).toBe(false);
    expect(isMarketplaceIntegrationEntityType('')).toBe(false);
  });
});
