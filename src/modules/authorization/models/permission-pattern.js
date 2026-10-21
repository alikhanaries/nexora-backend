/**
 * Tests whether a catalog permission key satisfies a role template pattern (all/exact/prefix/suffix).
 * @param {string} key
 * @param {object} pattern
 * @returns {boolean}
 */
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
/**
 * Resolves template patterns to concrete permission keys from the catalog (sorted, deduped).
 * @param {object[]} patterns
 * @param {string[]} catalogKeys
 * @returns {string[]}
 */
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
