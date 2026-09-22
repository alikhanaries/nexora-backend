import { describe, expect, it } from 'vitest';
import { mapCoreErrorToExternalResponse } from '../../../src/modules/compatibility/public/index.js';
import { NotFoundError, ValidationError } from '../../../src/shared/errors/index.js';

describe('mapCoreErrorToExternalResponse', () => {
    it('maps operational AppError to external HTTP shape without internal details', () => {
        const result = mapCoreErrorToExternalResponse(new NotFoundError('Order not found'));
        expect(result).toEqual({
            statusCode: 404,
            body: { message: 'Order not found' },
        });
    });

    it('includes safe details when present', () => {
        const result = mapCoreErrorToExternalResponse(new ValidationError('Invalid payload', { field: 'sku' }));
        expect(result).toEqual({
            statusCode: 400,
            body: { message: 'Invalid payload', details: { field: 'sku' } },
        });
    });

    it('maps unknown errors to a generic 500 response', () => {
        const result = mapCoreErrorToExternalResponse(new Error('sql: relation "orders" does not exist'));
        expect(result).toEqual({
            statusCode: 500,
            body: { message: 'An error occurred' },
        });
    });
});
