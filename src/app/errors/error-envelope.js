/**
 * Builds the public JSON error body (`success: false`) for internal API responses.
 */
import { GENERIC_ERROR_MESSAGE } from '../../shared/errors/index.js';

/** Maps an {@link AppError} to the wire envelope, redacting non-exposed messages. */
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
