/** Placeholder until an email/SMS adapter is wired. */
export class NoopPasswordResetNotifier {
    async notifyPasswordReset() {
        await Promise.resolve();
    }
}
