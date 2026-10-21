/**
 * Global Nest guard: JWT Bearer, Wasl API keys (`nxk_` / `X-Api-Key`), merchant
 * compat query/`X-CE-KEY` on `/api/v2` paths, and Stock Connect Bearer keys.
 * Resolves principals via `coreServices` and populates request context for handlers.
 */
import { Inject, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { isMerchantCompatQueryAuthPath } from '../../../shared/auth/merchant-compat-route-prefix.js';
import { isStockConnectIntegrationPath } from '../../../shared/auth/stock-connect-integration-route-prefix.js';
import {
  readMerchantCompatCeKeyHeader,
  readMerchantCompatQueryApiKey,
} from '../../../shared/auth/read-merchant-compat-query-api-key.js';
import { enrichRequestContext } from '../../../shared/context/request-context.js';
import { AuthenticationError, AuthorizationError } from '../../../shared/errors/index.js';
import { CORE_SERVICES } from '../../di/core-services.tokens.js';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator.js';
import { isPublicRoute } from '../auth/public-route.js';
import { parseApiKey } from '../../../modules/api-keys/models/api-key-secret.js';

/** Parses `Authorization: Bearer <token>`; returns the token string or null if missing/invalid. */
function readBearerToken(authorization) {
  if (typeof authorization !== 'string') {
    return null;
  }
  const match = /^Bearer\s+(\S+)$/i.exec(authorization);
  return match?.[1] ?? null;
}

/** True when the Bearer value is a Wasl API key (`nxk_` prefix). */
function isNexoraApiKeyBearer(token) {
  return typeof token === 'string' && token.startsWith('nxk_');
}

/**
 * Reads an API key from `X-Api-Key` or `Authorization: ApiKey <key>`.
 * @param {Record<string, string | string[] | undefined>} headers
 * @returns {string | null}
 */
function readApiKey(headers) {
  const headerKey = headers['x-api-key'];
  if (typeof headerKey === 'string' && headerKey.length > 0) {
    return headerKey;
  }
  const authorization = headers.authorization;
  if (typeof authorization !== 'string') {
    return null;
  }
  const apiKeyMatch = /^ApiKey\s+(\S+)$/i.exec(authorization);
  return apiKeyMatch?.[1] ?? null;
}

/**
 * Wasl API keys are `nxk_<prefix>.<secret>` (see formatApiKey). JWTs also contain dots,
 * so never treat Bearer as an API key unless the prefix segment is an nxk key.
 * @param {string} bearer
 */
function readBearerApiKeyRaw(bearer) {
  const trimmed = bearer.trim();
  const parsed = parseApiKey(trimmed);
  if (parsed === null || !parsed.prefix.startsWith('nxk_')) {
    return null;
  }
  return trimmed;
}

/** Returns trimmed `X-Tenant-Id` when present and non-empty. */
function readTenantIdHeader(headers) {
  const raw = headers['x-tenant-id'];
  if (typeof raw === 'string' && raw.trim().length > 0) {
    return raw.trim();
  }
  return null;
}

/**
 * When the client sends `X-Tenant-Id`, it must match the authenticated tenant or an authorization error is thrown.
 * @param {Record<string, string | string[] | undefined>} headers
 * @param {string} tenantId
 */
function assertTenantHeaderMatchesPrincipal(headers, tenantId) {
  const requestedTenantId = readTenantIdHeader(headers);
  if (requestedTenantId === null) {
    return;
  }
  if (requestedTenantId !== tenantId) {
    throw new AuthorizationError('X-Tenant-Id does not match authenticated tenant', {
      requestedTenantId,
    });
  }
}

/** Authenticates every non-public HTTP request before controller code runs. */
@Injectable()
class AuthGuard {
  /** @param {import('../../di/core-services.module.js').CoreServices} coreServices */
  constructor(@Inject(CORE_SERVICES) coreServices, @Inject(Reflector) reflector) {
    this.coreServices = coreServices;
    this.reflector = reflector;
  }

  /**
   * Skips public routes; otherwise verifies JWT, API key, Stock Connect Bearer key, or merchant compat key,
   * enriches request context with the principal, records auth metrics, and returns true on success.
   * @param {import('@nestjs/common').ExecutionContext} context
   * @returns {Promise<boolean>}
   */
  async canActivate(context) {
    const http = context.switchToHttp();
    const request = http.getRequest();
    const path = request.route?.path ?? request.path ?? request.url.split('?')[0] ?? request.url;

    if (this.reflector.get(IS_PUBLIC_KEY, context.getHandler())) {
      return true;
    }
    if (this.reflector.get(IS_PUBLIC_KEY, context.getClass())) {
      return true;
    }
    if (isPublicRoute(request.method, path)) {
      return true;
    }

    const bearer = readBearerToken(request.headers.authorization);
    const bearerApiKey =
      bearer !== null && isStockConnectIntegrationPath(path) ? readBearerApiKeyRaw(bearer) : null;
    let apiKey = readApiKey(request.headers);
    if (apiKey === null && bearer !== null && isNexoraApiKeyBearer(bearer) && bearerApiKey === null) {
      apiKey = bearer;
    }
    if (apiKey === null && isMerchantCompatQueryAuthPath(path)) {
      apiKey =
        readMerchantCompatQueryApiKey(request.query)
        ?? readMerchantCompatCeKeyHeader(request.headers);
    }

    const jwtBearer =
      bearer !== null && bearerApiKey === null && !isNexoraApiKeyBearer(bearer) ? bearer : null;

    if (jwtBearer !== null && apiKey !== null) {
      throw new AuthenticationError('Provide either Bearer token or API key, not both');
    }
    if (bearerApiKey !== null && apiKey !== null) {
      throw new AuthenticationError('Provide either Bearer token or API key, not both');
    }

    try {
      if (bearerApiKey !== null) {
        const verified = await this.coreServices.verifyApiKey.execute({ rawKey: bearerApiKey });
        assertTenantHeaderMatchesPrincipal(request.headers, verified.tenantId);
        const principal = {
          kind: 'api-key',
          id: verified.apiKeyId,
          tenantId: verified.tenantId,
          permissions: verified.permissions,
          authenticationMethod: 'api-key',
          apiKeyId: verified.apiKeyId,
          scopes: verified.scopes,
          ...(verified.channelId === undefined ? {} : { apiKeyChannelId: verified.channelId }),
        };
        enrichRequestContext({
          tenantId: principal.tenantId,
          principal,
        });
        this.coreServices.metrics.recordAuthEvent({ method: 'api-key', outcome: 'success' });
        return true;
      }
      if (jwtBearer !== null) {
        const principal = await this.coreServices.authenticateAccessToken.execute({
          accessToken: jwtBearer,
          authenticationMethod: 'password',
        });
        assertTenantHeaderMatchesPrincipal(request.headers, principal.tenantId);
        enrichRequestContext({
          tenantId: principal.tenantId,
          userId: principal.id,
          principal,
        });
        this.coreServices.metrics.recordAuthEvent({ method: 'jwt', outcome: 'success' });
        return true;
      }
      if (apiKey !== null) {
        const verified = await this.coreServices.verifyApiKey.execute({ rawKey: apiKey });
        assertTenantHeaderMatchesPrincipal(request.headers, verified.tenantId);
        const principal = {
          kind: 'api-key',
          id: verified.apiKeyId,
          tenantId: verified.tenantId,
          permissions: verified.permissions,
          authenticationMethod: 'api-key',
          apiKeyId: verified.apiKeyId,
          scopes: verified.scopes,
          ...(verified.channelId === undefined ? {} : { apiKeyChannelId: verified.channelId }),
        };
        enrichRequestContext({
          tenantId: principal.tenantId,
          principal,
        });
        this.coreServices.metrics.recordAuthEvent({ method: 'api-key', outcome: 'success' });
        return true;
      }
      throw new AuthenticationError();
    } catch (error) {
      this.coreServices.metrics.recordAuthEvent({
        method: apiKey !== null ? 'api-key' : 'jwt',
        outcome: 'failure',
      });
      throw error;
    }
  }
}
export { AuthGuard };
