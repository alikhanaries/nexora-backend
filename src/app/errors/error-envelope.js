import { GENERIC_ERROR_MESSAGE } from '../../shared/errors/index.js';
export function toErrorEnvelope(error, requestId) {
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
