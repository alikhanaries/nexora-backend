import { ZodError } from 'zod';
import { AppError, InternalError, MalformedRequestError, RateLimitError, ValidationError, } from '../../shared/errors/index.js';
import { toFieldIssues } from '../../shared/validation/index.js';
import { toErrorEnvelope } from './error-envelope.js';
export function mapErrorToHttp(error, requestId) {
    const appError = normaliseError(error);
    const body = toErrorEnvelope(appError, requestId);
    const retryAfterFromDetails = appError.safeDetails?.retryAfterSeconds;
    const headers = appError instanceof RateLimitError
        ? { 'retry-after': String(appError.retryAfterSeconds) }
        : typeof retryAfterFromDetails === 'number'
            ? { 'retry-after': String(retryAfterFromDetails) }
            : undefined;
    return {
        statusCode: appError.httpStatus,
        body,
        ...(headers === undefined ? {} : { headers }),
    };
}
function normaliseError(error) {
    if (AppError.isAppError(error))
        return error;
    if (error instanceof ZodError) {
        return new ValidationError('Request validation failed', {
            issues: toFieldIssues(error.issues),
        });
    }
    if (error instanceof SyntaxError) {
        return new MalformedRequestError('Request body could not be parsed', undefined, error);
    }
    return new InternalError(undefined, error);
}
