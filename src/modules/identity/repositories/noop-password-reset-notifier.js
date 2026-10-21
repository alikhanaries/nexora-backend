/** Placeholder until an email/SMS adapter is wired. */
export function createNoopPasswordResetNotifier() {
    return {
        async notifyPasswordReset() {
            await Promise.resolve();
        },
    };
}
