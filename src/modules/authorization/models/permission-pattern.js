export function permissionKeyMatchesPattern(key, pattern) {
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
export function expandPermissionPatterns(patterns, catalogKeys) {
    const matched = new Set();
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
