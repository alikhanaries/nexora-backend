/** Delivers password-reset links/tokens to the user (email, SMS, etc.). */
export interface PasswordResetNotifier {
  notifyPasswordReset(input: {
    readonly userId: string;
    readonly email: string;
    readonly resetToken: string;
  }): Promise<void>;
}
