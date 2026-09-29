#!/usr/bin/env node
/**
 * Documentation-only: compare POSTMAN inventory / API inventory vs Postman collection v2.1.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const COLLECTION = join(ROOT, 'postman/Nexora_Backend_API.postman_collection.json');
const POSTMAN_INV = join(ROOT, 'docs/POSTMAN_API_INVENTORY.md');

function expressToOpenApiPath(path) {
    return path.replace(/:([A-Za-z0-9_]+)/g, '{$1}');
}

function loadInventoryRows() {
    const md = readFileSync(POSTMAN_INV, 'utf8');
    const re = /\| (R-\d+|W-\d+) \| (GET|POST|PUT|PATCH|DELETE|HEAD|OPTIONS) \| `([^`]+)` \|/g;
    const rows = [];
    let m = re.exec(md);
    while (m !== null) {
        rows.push({ routeId: m[1], method: m[2], path: m[3] });
        m = re.exec(md);
    }
    return rows;
}

function normalizePostmanUrl(raw, pathArr, variables = []) {
    let path = raw ?? '';
    if (pathArr?.length) {
        path = `/${pathArr.join('/')}`;
    }
    path = path.replace(/\{\{baseUrl\}\}/g, '').replace(/\{\{workerBaseUrl\}\}/g, '');
    path = path.replace(/^https?:\/\/[^/]+/, '');
    for (const v of variables) {
        path = path.replace(new RegExp(`\\{\\{${v.key}\\}\\}`, 'g'), `{${v.key}}`);
    }
    path = path.replace(/\{\{([^}]+)\}\}/g, '{$1}');
    if (!path.startsWith('/')) {
        path = `/${path}`;
    }
    return path.replace(/\/+/g, '/');
}

function walkItems(items, acc = []) {
    for (const entry of items) {
        if (entry.item) {
            walkItems(entry.item, acc);
            continue;
        }
        if (!entry.request) {
            continue;
        }
        const req = entry.request;
        const url = req.url;
        let raw;
        let pathArr;
        let variables;
        if (typeof url === 'string') {
            raw = url;
        } else {
            raw = url.raw;
            pathArr = url.path;
            variables = url.variable;
        }
        const routeIdMatch = /^\[(R-\d+|W-\d+)\]/.exec(entry.name ?? '');
        acc.push({
            routeId: routeIdMatch?.[1] ?? null,
            name: entry.name,
            method: req.method?.toUpperCase(),
            path: normalizePostmanUrl(raw, pathArr, variables),
            folder: acc._folder ?? 'root',
            hasAuth: req.auth !== undefined,
            hasBody: req.body !== undefined,
            hasResponseExamples: Array.isArray(entry.response) && entry.response.length > 0,
        });
    }
    return acc;
}

function collectWithFolders(items, folder = 'root', acc = []) {
    for (const entry of items) {
        if (entry.item) {
            collectWithFolders(entry.item, entry.name, acc);
            continue;
        }
        if (!entry.request) {
            continue;
        }
        const req = entry.request;
        const url = req.url;
        let raw;
        let pathArr;
        let variables;
        if (typeof url === 'string') {
            raw = url;
        } else {
            raw = url.raw;
            pathArr = url.path;
            variables = url.variable;
        }
        const routeIdMatch = /^\[(R-\d+|W-\d+)\]/.exec(entry.name ?? '');
        acc.push({
            routeId: routeIdMatch?.[1] ?? null,
            name: entry.name,
            method: req.method?.toUpperCase(),
            path: normalizePostmanUrl(raw, pathArr, variables),
            folder,
            hasAuth: req.auth !== undefined,
            hasBody: req.body !== undefined,
            hasResponseExamples: Array.isArray(entry.response) && entry.response.length > 0,
        });
    }
    return acc;
}

function inventoryKey(row) {
    return `${row.method} ${expressToOpenApiPath(row.path)}`;
}

function requestKey(req) {
    const scope = req.routeId?.startsWith('W-') ? 'worker' : 'main';
    return `${scope} ${req.method} ${req.path}`;
}

function validateCollectionJson(collection) {
    if (collection.info?.schema !== 'https://schema.getpostman.com/json/collection/v2.1.0/collection.json') {
        return 'Collection schema URL is not Postman v2.1.0';
    }
    if (!Array.isArray(collection.item)) {
        return 'Missing item array';
    }
    return null;
}

function main() {
    const collection = JSON.parse(readFileSync(COLLECTION, 'utf8'));
    const schemaError = validateCollectionJson(collection);
    const inventory = loadInventoryRows();
    const requests = collectWithFolders(collection.item);

    const byRouteId = new Map(requests.filter((r) => r.routeId).map((r) => [r.routeId, r]));
    const byKey = new Map();
    for (const r of requests) {
        const k = requestKey(r);
        if (!byKey.has(k)) {
            byKey.set(k, []);
        }
        byKey.get(k).push(r);
    }

    const missing = [];
    const matched = [];
    for (const row of inventory) {
        const key = inventoryKey(row);
        const req = byRouteId.get(row.routeId);
        if (req === undefined) {
            missing.push({ row, reason: 'No Postman request with matching Route ID' });
            continue;
        }
        const expectedScope = row.routeId.startsWith('W-') ? 'worker' : 'main';
        const expectedKey = `${expectedScope} ${row.method} ${expressToOpenApiPath(row.path)}`;
        if (requestKey(req) !== expectedKey) {
            missing.push({ row, reason: `Path/method mismatch: Postman has ${requestKey(req)}` });
            continue;
        }
        matched.push({ row, req });
    }

    const duplicates = [...byKey.entries()].filter(([, list]) => list.length > 1);

    const lines = [];
    lines.push('# Postman coverage report');
    lines.push('');
    lines.push(`**Collection:** \`postman/Nexora_Backend_API.postman_collection.json\``);
    lines.push('');
    lines.push('## Summary');
    lines.push('');
    lines.push('| Metric | Count |');
    lines.push('| ------ | ----: |');
    lines.push(`| Confirmed main-server endpoints | ${inventory.filter((r) => r.routeId.startsWith('R-')).length} |`);
    lines.push(`| Worker-only endpoints | ${inventory.filter((r) => r.routeId.startsWith('W-')).length} |`);
    lines.push(`| Total inventory endpoints | ${inventory.length} |`);
    lines.push(`| Postman requests (leaf) | ${requests.length} |`);
    lines.push(`| Matched by Route ID | ${matched.length} |`);
    lines.push(`| Missing | ${missing.length} |`);
    lines.push(`| Duplicate method+path requests | ${duplicates.reduce((n, [, l]) => n + l.length - 1, 0)} |`);
    lines.push(`| Requests with auth block | ${requests.filter((r) => r.hasAuth).length} |`);
    lines.push(`| Requests with body | ${requests.filter((r) => r.hasBody).length} |`);
    lines.push(`| Requests with response examples | ${requests.filter((r) => r.hasResponseExamples).length} |`);
    lines.push(`| Collection JSON valid v2.1 | ${schemaError === null ? 'yes' : `no (${schemaError})`} |`);
    lines.push('');

    lines.push('## Route-to-Postman mapping');
    lines.push('');
    lines.push('| Route ID | HTTP Method | Full API Path | Postman Folder | Request Name | Collection Status | Verification |');
    lines.push('| -------- | ----------- | ------------- | -------------- | ------------ | ----------------- | ------------ |');
    for (const row of inventory) {
        const req = byRouteId.get(row.routeId);
        if (req === undefined) {
            lines.push(
                `| ${row.routeId} | ${row.method} | \`${row.path}\` | — | — | MISSING | GAP |`,
            );
            continue;
        }
        const expectedScope = row.routeId.startsWith('W-') ? 'worker' : 'main';
        const ok = requestKey(req) === `${expectedScope} ${inventoryKey(row)}`;
        lines.push(
            `| ${row.routeId} | ${row.method} | \`${row.path}\` | ${req.folder} | ${req.name.replace(/\|/g, '\\|')} | ${ok ? 'GENERATED' : 'MISMATCH'} | ${ok ? 'MATCH' : 'FAIL'} |`,
        );
    }
    lines.push('');

    if (missing.length > 0) {
        lines.push('## Gaps');
        lines.push('');
        for (const m of missing) {
            lines.push(`- \`${m.row.routeId}\` ${m.row.method} \`${m.row.path}\`: ${m.reason}`);
        }
        lines.push('');
    }

    const out = join(ROOT, 'docs/POSTMAN_COVERAGE_REPORT.md');
    writeFileSync(out, `${lines.join('\n')}\n`, 'utf8');
    console.log(`Wrote ${out}`);
    if (missing.length > 0 || schemaError) {
        process.exitCode = 1;
    }
}

main();
