import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

describe('compatibility architecture rules', () => {
    const configSource = readFileSync(new URL('../../../.dependency-cruiser.cjs', import.meta.url), 'utf8');

    it('forbids core modules from importing compatibility', () => {
        expect(configSource).toContain("name: 'core-no-compatibility'");
    });

    it('forbids compatibility from direct persistence access', () => {
        expect(configSource).toContain("name: 'compatibility-no-direct-persistence'");
        expect(configSource).toContain("^src/modules/compatibility/'");
    });

    it('forbids compatibility from importing other modules through root index', () => {
        expect(configSource).toContain("name: 'compatibility-no-module-index-imports'");
    });

    it('forbids compatibility from importing other modules private layers', () => {
        expect(configSource).toContain("name: 'compatibility-public-contracts-only'");
    });

    it('keeps cross-module integration on public contracts', () => {
        expect(configSource).toContain("name: 'no-cross-module-internals'");
    });

    it('rejects circular dependencies', () => {
        expect(configSource).toContain("name: 'no-circular'");
    });
});
