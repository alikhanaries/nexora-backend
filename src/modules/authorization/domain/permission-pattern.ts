/**
 * Permission patterns used when seeding system roles.
 *
 * Authorization checks at runtime use concrete permission keys resolved from
 * the database — never wildcard patterns.
 */
export type PermissionPattern =
  | { readonly kind: 'all' }
  | { readonly kind: 'exact'; readonly key: string }
  | { readonly kind: 'prefix'; readonly prefix: string }
  | { readonly kind: 'suffix'; readonly suffix: string };

export function permissionKeyMatchesPattern(key: string, pattern: PermissionPattern): boolean {
  switch (pattern.kind) {
    case 'all':
      return true;
    case 'exact':
      return key === pattern.key;
    case 'prefix':
      return key.startsWith(`${pattern.prefix}.`);
    case 'suffix':
      return key.endsWith(pattern.suffix);
  }
}

export function expandPermissionPatterns(
  patterns: readonly PermissionPattern[],
  catalogKeys: readonly string[],
): readonly string[] {
  const matched = new Set<string>();

  for (const key of catalogKeys) {
    for (const pattern of patterns) {
      if (permissionKeyMatchesPattern(key, pattern)) {
        matched.add(key);
        break;
      }
    }
  }

  return [...matched].sort();
}
