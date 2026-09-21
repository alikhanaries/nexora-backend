import { describe, expect, it } from 'vitest';
import { ErrorCode } from '../../src/shared/errors/index.js';
import { mapPostgresError } from '../../src/infrastructure/postgres/postgres-errors.js';
describe('SQLSTATE mapping', () => {
    it('maps unique violations to conflict', () => {
        const mapped = mapPostgresError({ code: '23505', constraint: 'x_uidx' }, 'insert');
        expect(mapped.code).toBe(ErrorCode.CONFLICT);
        expect(mapped.httpStatus).toBe(409);
    });
    it('maps unknown database errors to DATABASE_UNAVAILABLE without exposing driver text', () => {
        const mapped = mapPostgresError(new Error('connection refused host=secret'), 'query');
        expect(mapped.code).toBe(ErrorCode.DATABASE_UNAVAILABLE);
        expect(mapped.exposeMessage).toBe(false);
    });
});
