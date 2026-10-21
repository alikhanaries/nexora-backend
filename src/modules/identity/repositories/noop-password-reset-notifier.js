/** Placeholder until an email/SMS adapter is wired. */
export function createNoopPasswordResetNotifier() {
    return {
        /** Accepts reset notification payload; intentionally does not send mail in dev/default wiring. */
        async notifyPasswordReset() {
            await Promise.resolve();
        },
    };
}
