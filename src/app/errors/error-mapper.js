import { ZodError } from 'zod';
import { AppError, InternalError, MalformedRequestError, RateLimitError, ValidationError, } from '../../shared/errors/index.js';
import { toFieldIssues } from '../../shared/validation/index.js';
import { toErrorEnvelope } from './error-envelope.js';
export function mapErrorToHttp(error, requestId) {
    const appError = normaliseError(error);
    const body = toErrorEnvelope(appError, requestId);
    const headers = appError instanceof RateLimitError
        ? { 'retry-after': String(appError.retryAfterSeconds) }
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
    const fastifyValidation = readFastifyValidation(error);
    if (fastifyValidation !== undefined)
        return fastifyValidation;
    return new InternalError(undefined, error);
}
function readFastifyValidation(error) {
    if (typeof error !== 'object' || error === null)
        return undefined;
    const candidate = error;
    if (candidate.code !== 'FST_ERR_VALIDATION' || !Array.isArray(candidate.validation)) {
        return undefined;
    }
    return new ValidationError('Request validation failed', {
        issues: candidate.validation.map((issue) => {
            if (typeof issue !== 'object' || issue === null) {
                return { path: '(unknown)', message: 'Invalid request' };
            }
            const record = issue;
            return {
                path: record.instancePath === '' ? '(root)' : (record.instancePath ?? '(unknown)'),
                message: record.message ?? 'Invalid request',
            };
        }),
    });
}
