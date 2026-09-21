import type { PasswordResetNotifier } from '../application/ports/password-reset-notifier.js';

/** Placeholder until an email/SMS adapter is wired. */
export class NoopPasswordResetNotifier implements PasswordResetNotifier {
  async notifyPasswordReset(): Promise<void> {
    await Promise.resolve();
  }
}
