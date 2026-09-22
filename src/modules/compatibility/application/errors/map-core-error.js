import { ZodError } from 'zod';
import { AppError, InternalError, MalformedRequestError, ValidationError, } from '../../../../shared/errors/index.js';
import { toFieldIssues } from '../../../../shared/validation/index.js';

function readFastifyValidation(error) {
    if (typeof error !== 'object' || error === null) {
        return undefined;
    }
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

function normaliseCompatibilityError(error) {
    if (AppError.isAppError(error)) {
        return error;
    }
    if (error instanceof ZodError) {
        return new ValidationError('Request validation failed', {
            issues: toFieldIssues(error.issues),
        });
    }
    if (error instanceof SyntaxError) {
        return new MalformedRequestError('Request body could not be parsed', undefined, error);
    }
    const fastifyValidation = readFastifyValidation(error);
    if (fastifyValidation !== undefined) {
        return fastifyValidation;
    }
    return new InternalError(undefined, error);
}

/**
 * Maps a provider-neutral core error to an external compatibility HTTP response.
 *
 * Presentation handlers apply provider-specific response shapes on top of this mapping
 * in later Phase 5 steps. Core errors must never carry external API terminology.
 *
 * @param {unknown} error
 * @returns {{ statusCode: number, body: { message: string, details?: unknown } }}
 */
export function mapCoreErrorToExternalResponse(error) {
    const appError = normaliseCompatibilityError(error);
    if (AppError.isAppError(appError)) {
        return {
            statusCode: appError.httpStatus,
            body: {
                message: appError.exposeMessage ? appError.message : 'An error occurred',
                ...(appError.safeDetails === undefined ? {} : { details: appError.safeDetails }),
            },
        };
    }
    return {
        statusCode: 500,
        body: { message: 'An error occurred' },
    };
}

/**
 * Maps a core error to the Merchant-compatible ApiResponse error envelope.
 *
 * @param {unknown} error
 * @returns {{ statusCode: number, body: object }}
 */
function mapValidationDetailsToExternalErrors(details) {
    if (typeof details !== 'object' || details === null) {
        return undefined;
    }
    const record = details;
    if (!Array.isArray(record.issues)) {
        return undefined;
    }
    const validationErrors = {};
    for (const issue of record.issues) {
        if (typeof issue !== 'object' || issue === null) {
            continue;
        }
        const path = typeof issue.path === 'string' ? issue.path : '(unknown)';
        const message = typeof issue.message === 'string' ? issue.message : 'Invalid request';
        const existing = validationErrors[path];
        if (existing === undefined) {
            validationErrors[path] = [message];
        }
        else {
            existing.push(message);
        }
    }
    return Object.keys(validationErrors).length > 0 ? validationErrors : undefined;
}

export function mapCoreErrorToExternalApiResponse(error) {
    const mapped = mapCoreErrorToExternalResponse(error);
    const validationErrors = mapped.body.details === undefined
        ? undefined
        : mapValidationDetailsToExternalErrors(mapped.body.details);
    return {
        statusCode: mapped.statusCode,
        body: {
            Success: false,
            StatusCode: mapped.statusCode,
            Message: mapped.body.message,
            ...(validationErrors === undefined ? {} : { ValidationErrors: validationErrors }),
        },
    };
}
