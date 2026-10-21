/**
 * Nest metadata marker for routes that skip the global {@link AuthGuard}.
 */
import { SetMetadata } from '@nestjs/common';

/** Reflector key read by {@link AuthGuard}. */
export const IS_PUBLIC_KEY = 'nestIsPublic';

/** Marks a controller handler or class as publicly accessible. */
export function Public() {
  return SetMetadata(IS_PUBLIC_KEY, true);
}
