import { getRequestContext } from '../../../shared/context/request-context.js';

export function auditRequestFields(): {
  readonly ipAddress?: string | null;
  readonly requestId?: string | null;
} {
  const context = getRequestContext();
  return {
    ...(context?.ip === undefined ? {} : { ipAddress: context.ip }),
    ...(context?.requestId === undefined ? {} : { requestId: context.requestId }),
  };
}
