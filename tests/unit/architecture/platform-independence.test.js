import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const repoRoot = fileURLToPath(new URL('../../../', import.meta.url));

const PROVIDER_NAME_PATTERN = /\b(?:ChannelEngine|channelengine|channel-engine|CHANNEL_ENGINE)\b/;

const COMPATIBILITY_IMPORT_PATTERN = /modules\/compatibility/;

/** @param {string} dir */
function collectJsFiles(dir, files = []) {
    for (const entry of readdirSync(dir)) {
        const fullPath = join(dir, entry);
        const stat = statSync(fullPath);
        if (stat.isDirectory()) {
            if (entry === 'node_modules') {
                continue;
            }
            collectJsFiles(fullPath, files);
            continue;
        }
        if (entry.endsWith('.js') && !entry.endsWith('.test.js')) {
            files.push(fullPath);
        }
    }
    return files;
}

describe('platform independence', () => {
    const configSource = readFileSync(join(repoRoot, '.dependency-cruiser.cjs'), 'utf8');

    it('defines architecture rules for core/compatibility isolation', () => {
        expect(configSource).toContain("name: 'core-no-compatibility'");
        expect(configSource).toContain("name: 'compatibility-no-direct-persistence'");
        expect(configSource).toContain("name: 'compatibility-public-contracts-only'");
    });

    it('does not use provider-specific names in core source modules', () => {
        const modulesRoot = join(repoRoot, 'src/modules');
        const offenders = [];
        for (const file of collectJsFiles(modulesRoot)) {
            const rel = relative(repoRoot, file).replace(/\\/g, '/');
            if (rel.startsWith('src/modules/compatibility/')) {
                continue;
            }
            const content = readFileSync(file, 'utf8');
            if (PROVIDER_NAME_PATTERN.test(content)) {
                offenders.push(rel);
            }
        }
        expect(offenders).toEqual([]);
    });

    it('imports compatibility only from the composition root wiring', () => {
        const allowed = new Set([
            'src/app/bootstrap/create-application.js',
            'src/app/http/create-server.js',
        ]);
        const offenders = [];
        for (const file of collectJsFiles(join(repoRoot, 'src'))) {
            const rel = relative(repoRoot, file).replace(/\\/g, '/');
            if (rel.startsWith('src/modules/compatibility/')) {
                continue;
            }
            const content = readFileSync(file, 'utf8');
            if (COMPATIBILITY_IMPORT_PATTERN.test(content) && !allowed.has(rel)) {
                offenders.push(rel);
            }
        }
        expect(offenders).toEqual([]);
    });

    it('does not use provider-specific names in shared or infrastructure layers', () => {
        const offenders = [];
        for (const root of ['src/shared', 'src/infrastructure', 'src/workers']) {
            for (const file of collectJsFiles(join(repoRoot, root))) {
                const rel = relative(repoRoot, file).replace(/\\/g, '/');
                const content = readFileSync(file, 'utf8');
                if (PROVIDER_NAME_PATTERN.test(content)) {
                    offenders.push(rel);
                }
            }
        }
        expect(offenders).toEqual([]);
    });
});
