/**
 * Gate for `/api/v2/stock-connect/*` when integration is enabled in config.
 * Validates feature flag and optional `X-Tenant-Id` against request context; non-integration paths pass through.
 */
import { Inject, Injectable } from '@nestjs/common';
import { AuthorizationError, NotFoundError } from '../../../../../shared/errors/index.js';
import { getRequestContext } from '../../../../../shared/context/request-context.js';
import { isStockConnectIntegrationPath } from '../../../../../shared/auth/stock-connect-integration-route-prefix.js';
import { WASL_CONFIG } from '../../../../../app/config/wasl-config.module.js';

/** Applied on all StockConnect Nest controllers via `@UseGuards`. */
@Injectable()
class StockConnectIntegrationGuard {
  /** @param {{ stockConnect: { integrationEnabled: boolean } }} config */
  constructor(@Inject(WASL_CONFIG) config) {
    this.config = config;
  }

  /**
   * Allows non–Stock Connect routes; on Stock Connect paths enforces integration flag and optional `X-Tenant-Id`.
   * @param {import('@nestjs/common').ExecutionContext} context
   * @returns {boolean}
   */
  canActivate(context) {
    const request = context.switchToHttp().getRequest();
    const path = request.route?.path ?? request.path ?? request.url.split('?')[0] ?? request.url;
    if (!isStockConnectIntegrationPath(path)) {
      return true;
    }
    if (!this.config.stockConnect.integrationEnabled) {
      throw new NotFoundError('StockConnect integration is disabled');
    }
    const headerTenantId = request.headers['x-tenant-id'];
    if (typeof headerTenantId === 'string' && headerTenantId.length > 0) {
      const ctx = getRequestContext();
      const authenticatedTenantId = ctx?.tenantId;
      if (authenticatedTenantId !== undefined && headerTenantId !== authenticatedTenantId) {
        throw new AuthorizationError('X-Tenant-Id does not match the authenticated tenant');
      }
    }
    return true;
  }
}
export { StockConnectIntegrationGuard };
