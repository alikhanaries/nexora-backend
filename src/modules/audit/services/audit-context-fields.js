import { getRequestContext } from '../../../shared/context/request-context.js';

/**
 * Pulls request IP and correlation id from async context for audit rows.
 * @returns {{ ipAddress?: string, requestId?: string }}
 */
export function auditRequestFields() {
    const context = getRequestContext();
    return {
        ...(context?.ip === undefined ? {} : { ipAddress: context.ip }),
        ...(context?.requestId === undefined ? {} : { requestId: context.requestId }),
    };
}
