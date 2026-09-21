import type { AppError } from '../../shared/errors/index.js';
import { GENERIC_ERROR_MESSAGE } from '../../shared/errors/index.js';

export interface ErrorEnvelopeBody {
  readonly success: false;
  readonly error: {
    readonly code: string;
    readonly message: string;
    readonly details?: Readonly<Record<string, unknown>>;
  };
  readonly requestId: string;
}

export function toErrorEnvelope(error: AppError, requestId: string): ErrorEnvelopeBody {
  const message = error.exposeMessage ? error.message : GENERIC_ERROR_MESSAGE;
  return {
    success: false,
    error: {
      code: error.code,
      message,
      ...(error.safeDetails === undefined ? {} : { details: error.safeDetails }),
    },
    requestId,
  };
}
