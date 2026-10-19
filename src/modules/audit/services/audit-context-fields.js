import { getRequestContext } from '../../../shared/context/request-context.js';
export function auditRequestFields() {
    const context = getRequestContext();
    return {
        ...(context?.ip === undefined ? {} : { ipAddress: context.ip }),
        ...(context?.requestId === undefined ? {} : { requestId: context.requestId }),
    };
}
