import { describe, expect, it } from 'vitest';
import { mapErrorToHttp } from '../../src/app/errors/error-mapper.js';
import { AppError, ErrorCode, GENERIC_ERROR_MESSAGE, IdempotencyConflictError, InternalError, ValidationError, } from '../../src/shared/errors/index.js';
describe('error mapping', () => {
    it('maps validation errors to 400 with stable code', () => {
        const mapped = mapErrorToHttp(new ValidationError('bad input'), 'req-1');
        expect(mapped.statusCode).toBe(400);
        expect(mapped.body.error.code).toBe(ErrorCode.VALIDATION_FAILED);
        expect(mapped.body.requestId).toBe('req-1');
    });
    it('redacts internal errors in production responses', () => {
        const mapped = mapErrorToHttp(new InternalError('secret detail'), 'req-2');
        expect(mapped.body.error.message).toBe(GENERIC_ERROR_MESSAGE);
        expect(mapped.body.error.code).toBe(ErrorCode.INTERNAL_ERROR);
    });
    it('maps idempotency conflict to 409', () => {
        const mapped = mapErrorToHttp(new IdempotencyConflictError(), 'req-3');
        expect(mapped.statusCode).toBe(409);
        expect(mapped.body.error.code).toBe(ErrorCode.IDEMPOTENCY_CONFLICT);
    });
    it('preserves AppError safe details', () => {
        const mapped = mapErrorToHttp(new AppError({
            code: ErrorCode.NOT_FOUND,
            message: 'missing',
            httpStatus: 404,
            safeDetails: { resource: 'x' },
        }), 'req-4');
        expect(mapped.body.error.details).toEqual({ resource: 'x' });
    });
});
