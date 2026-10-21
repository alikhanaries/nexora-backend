import { AuthenticationError } from '../errors/index.js';
import { getRequestContext } from './request-context.js';
/** Returns tenant/user/api-key actor fields from context or throws 401. */
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
        ...(principal.apiKeyChannelId === undefined ? {} : { apiKeyChannelId: principal.apiKeyChannelId }),
        ...(principal.email === undefined ? {} : { email: principal.email }),
    };
}
