import { Inject, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { enrichRequestContext } from '../../../shared/context/request-context.js';
import { AuthenticationError } from '../../../shared/errors/index.js';
import { CORE_DOMAIN } from '../../domain/core-domain.tokens.js';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator.js';
import { isPublicRoute } from '../auth/public-route.js';

function readBearerToken(authorization) {
  if (typeof authorization !== 'string') {
    return null;
  }
  const match = /^Bearer\s+(\S+)$/i.exec(authorization);
  return match?.[1] ?? null;
}

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

export @Injectable()
class AuthGuard {
  constructor(@Inject(CORE_DOMAIN) coreDomain, @Inject(Reflector) reflector) {
    this.coreDomain = coreDomain;
    this.reflector = reflector;
  }

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
    const apiKey = readApiKey(request.headers);

    if (bearer !== null && apiKey !== null) {
      throw new AuthenticationError('Provide either Bearer token or API key, not both');
    }

    try {
      if (bearer !== null) {
        const principal = await this.coreDomain.authenticateAccessToken.execute({
          accessToken: bearer,
          authenticationMethod: 'password',
        });
        enrichRequestContext({
          tenantId: principal.tenantId,
          userId: principal.id,
          principal,
        });
        this.coreDomain.metrics.recordAuthEvent({ method: 'jwt', outcome: 'success' });
        return true;
      }
      if (apiKey !== null) {
        const verified = await this.coreDomain.verifyApiKey.execute({ rawKey: apiKey });
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
        this.coreDomain.metrics.recordAuthEvent({ method: 'api-key', outcome: 'success' });
        return true;
      }
      throw new AuthenticationError();
    } catch (error) {
      this.coreDomain.metrics.recordAuthEvent({
        method: apiKey !== null ? 'api-key' : 'jwt',
        outcome: 'failure',
      });
      throw error;
    }
  }
}
