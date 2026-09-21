import { ValidationError } from '../../../shared/errors/index.js';
import { normalizeEmail } from '../../../shared/security/index.js';

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Normalized email address used for lookup and uniqueness. */
export class Email {
  readonly raw: string;
  readonly normalized: string;

  private constructor(raw: string, normalized: string) {
    this.raw = raw;
    this.normalized = normalized;
  }

  static create(email: string): Email {
    if (typeof email !== 'string' || email.trim().length === 0) {
      throw new ValidationError('Email is required');
    }

    const raw = email.trim();
    const normalized = normalizeEmail(email);

    if (!EMAIL_PATTERN.test(normalized)) {
      throw new ValidationError('Email format is invalid');
    }

    return new Email(raw, normalized);
  }
}
