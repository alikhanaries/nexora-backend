import { AuthenticationError } from '../errors/index.js';
import { getRequestContext } from './request-context.js';
export function requireActorContext() {
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
