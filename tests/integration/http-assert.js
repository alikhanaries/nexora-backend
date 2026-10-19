import { expect } from 'vitest';

/**
 * Assert HTTP status with response body in the failure message (integration diagnostics).
 * @param {{ statusCode: number, body?: string, json?: () => unknown }} response
 * @param {number} expected
 * @param {string} step
 */
export function expectHttpStatus(response, expected, step) {
    if (response.statusCode === expected) {
        return;
    }
    let detail = response.body ?? '';
    try {
        detail = JSON.stringify(response.json());
    } catch {
        // keep raw body
    }
    expect(response.statusCode, `${step} failed: ${detail}`).toBe(expected);
}
