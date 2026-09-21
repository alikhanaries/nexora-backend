import { AuthenticationError } from '../errors/index.js';
import { getRequestContext } from './request-context.js';

export interface ActorContext {
  readonly tenantId: string;
  readonly permissions: readonly string[];
  readonly userId?: string;
  readonly sessionId?: string;
  readonly apiKeyId?: string;
  readonly email?: string;
}

export function requireActorContext(): ActorContext {
  const context = getRequestContext();
  const principal = context?.principal;

  if (principal === undefined) {
    throw new AuthenticationError('Authentication is required');
  }

  return {
    tenantId: principal.tenantId,
    permissions: principal.permissions,
    ...(principal.kind === 'user' ? { userId: principal.id } : {}),
    ...(principal.sessionId === undefined ? {} : { sessionId: principal.sessionId }),
    ...(principal.apiKeyId === undefined ? {} : { apiKeyId: principal.apiKeyId }),
    ...(principal.email === undefined ? {} : { email: principal.email }),
  };
}
