import { AuthenticationError } from '../../../shared/errors/index.js';

/** Generic auth failure — never reveals whether email, password, or tenant was wrong. */
export const INVALID_CREDENTIALS_MESSAGE = 'Invalid credentials';

export class InvalidCredentialsError extends AuthenticationError {
  constructor() {
    super(INVALID_CREDENTIALS_MESSAGE);
  }
}
