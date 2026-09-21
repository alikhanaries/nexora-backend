export interface AccessTokenPayload {
  readonly sub: string;
  readonly tenantId: string;
  readonly sessionId: string;
  readonly tokenVersion: number;
}

export interface AccessTokenService {
  sign(payload: AccessTokenPayload): Promise<string>;
  verify(token: string): Promise<AccessTokenPayload>;
}

export interface PasswordHasher {
  hash(password: string): Promise<string>;
  verify(password: string, hash: string): Promise<boolean>;
}

export interface SecretEncryptor {
  encrypt(plaintext: string): string;
  decrypt(ciphertext: string): string;
}
