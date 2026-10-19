import { SetMetadata } from '@nestjs/common';

export const IS_PUBLIC_KEY = 'nestIsPublic';

export function Public() {
  return SetMetadata(IS_PUBLIC_KEY, true);
}
