import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { ValidationError } from '../../src/shared/errors/index.js';
import { parseOrThrow } from '../../src/shared/validation/index.js';

describe('validation', () => {
  it('throws ValidationError with field issues', () => {
    const schema = z.object({ name: z.string().min(1) });
    expect(() => parseOrThrow(schema, {}, 'payload')).toThrow(ValidationError);
    try {
      parseOrThrow(schema, {}, 'payload');
    } catch (error) {
      expect(error).toBeInstanceOf(ValidationError);
      const validationError = error as ValidationError;
      expect(validationError.safeDetails?.['issues']).toBeDefined();
    }
  });
});
