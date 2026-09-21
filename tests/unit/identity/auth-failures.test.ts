import { describe, expect, it } from 'vitest';
import { mapErrorToHttp } from '../../../src/app/errors/error-mapper.js';
import { ErrorCode } from '../../../src/shared/errors/index.js';
import {
  InvalidCredentialsError,
  INVALID_CREDENTIALS_MESSAGE,
} from '../../../src/modules/identity/domain/index.js';

describe('auth failure responses', () => {
  it('uses generic Invalid credentials message', () => {
    const error = new InvalidCredentialsError();
    expect(error.message).toBe(INVALID_CREDENTIALS_MESSAGE);
    expect(error.message).toBe('Invalid credentials');
  });

  it('maps InvalidCredentialsError to 401 without leaking details', () => {
    const mapped = mapErrorToHttp(new InvalidCredentialsError(), 'req-auth-1');
    expect(mapped.statusCode).toBe(401);
    expect(mapped.body.error.code).toBe(ErrorCode.AUTHENTICATION_REQUIRED);
    expect(mapped.body.error.message).toBe('Invalid credentials');
    expect(mapped.body.error.details).toBeUndefined();
  });
});
