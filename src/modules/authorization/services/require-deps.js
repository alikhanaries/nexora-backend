/**
 * @param {object} deps
 * @param {string} factoryName
 * @param {string[]} required
 */
export function requireAuthorizationDeps(deps, factoryName, required) {
    if (deps === undefined || deps === null || typeof deps !== 'object') {
        throw new Error(`${factoryName} requires a deps object`);
    }
    for (const name of required) {
        if (deps[name] === undefined || deps[name] === null) {
            throw new Error(`${factoryName} requires deps.${name}`);
        }
    }
}
