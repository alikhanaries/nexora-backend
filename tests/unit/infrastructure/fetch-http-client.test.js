import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
    createFetchHttpClient,
    FetchHttpClient,
} from '../../../src/infrastructure/http/fetch-http-client.js';
import * as tracing from '../../../src/infrastructure/observability/tracing.js';
import {
    createRequestContext,
    runWithRequestContext,
} from '../../../src/shared/context/request-context.js';
import { REQUEST_ID_HEADER } from '../../../src/shared/context/request-id.js';
import {
    ExternalServiceError,
    ExternalServiceTimeoutError,
} from '../../../src/shared/errors/index.js';

/**
 * Characterisation suite for the FetchHttpClient / createFetchHttpClient contract
 * (Phase 4.20 baseline; Phase 4.21 factory migration).
 * Uses a stubbed global fetch — no live network.
 */

function createLogger() {
    const logger = {
        debug: vi.fn(),
        warn: vi.fn(),
        info: vi.fn(),
        error: vi.fn(),
        child: vi.fn(),
    };
    logger.child.mockReturnValue(logger);
    return logger;
}

/**
 * @param {{ status?: number, ok?: boolean, headers?: Record<string, string>, body?: string }} [options]
 */
function mockFetchResponse(options = {}) {
    const status = options.status ?? 200;
    const headers = new Headers(options.headers ?? { 'content-type': 'application/json' });
    return {
        ok: options.ok ?? (status >= 200 && status < 300),
        status,
        headers,
        text: vi.fn(async () => options.body ?? ''),
    };
}

function createClient(overrides = {}) {
    const logger = createLogger();
    const client = createFetchHttpClient({
        config: { timeoutMs: overrides.timeoutMs ?? 5_000 },
        logger,
    });
    return { client, logger };
}

describe('createFetchHttpClient characterisation', () => {
    /** @type {ReturnType<typeof vi.fn>} */
    let fetchMock;
    /** @type {import('vitest').MockInstance} */
    let currentTraceIdSpy;

    beforeEach(() => {
        fetchMock = vi.fn();
        vi.stubGlobal('fetch', fetchMock);
        currentTraceIdSpy = vi.spyOn(tracing, 'currentTraceId').mockReturnValue(undefined);
    });

    afterEach(() => {
        vi.unstubAllGlobals();
        vi.restoreAllMocks();
    });

    describe('successful responses', () => {
        it('returns parsed JSON body, status, headers, ok, and durationMs', async () => {
            fetchMock.mockResolvedValue(
                mockFetchResponse({
                    status: 200,
                    headers: { 'content-type': 'application/json', 'x-upstream': '1' },
                    body: '{"id":"abc"}',
                }),
            );
            const { client } = createClient();

            const result = await client.send({
                operation: 'test.json',
                method: 'GET',
                url: 'https://example.test/resource',
            });

            expect(result.status).toBe(200);
            expect(result.ok).toBe(true);
            expect(result.body).toEqual({ id: 'abc' });
            expect(result.headers['x-upstream']).toBe('1');
            expect(typeof result.durationMs).toBe('number');
            expect(result.durationMs).toBeGreaterThanOrEqual(0);
        });

        it('returns null for empty response bodies', async () => {
            fetchMock.mockResolvedValue(
                mockFetchResponse({
                    headers: { 'content-type': 'application/json' },
                    body: '',
                }),
            );
            const { client } = createClient();

            const result = await client.send({
                operation: 'test.empty',
                method: 'GET',
                url: 'https://example.test/empty',
            });

            expect(result.body).toBeNull();
        });

        it('returns text for non-JSON content types', async () => {
            fetchMock.mockResolvedValue(
                mockFetchResponse({
                    headers: { 'content-type': 'text/plain' },
                    body: 'plain-ok',
                }),
            );
            const { client } = createClient();

            const result = await client.send({
                operation: 'test.text',
                method: 'GET',
                url: 'https://example.test/plain',
            });

            expect(result.body).toBe('plain-ok');
        });

        it('returns raw text when content-type is JSON but body is malformed', async () => {
            fetchMock.mockResolvedValue(
                mockFetchResponse({
                    headers: { 'content-type': 'application/json' },
                    body: '{not-json',
                }),
            );
            const { client } = createClient();

            const result = await client.send({
                operation: 'test.malformed-json',
                method: 'GET',
                url: 'https://example.test/broken-json',
            });

            expect(result.body).toBe('{not-json');
        });
    });

    describe('request construction', () => {
        it('defaults Accept to application/json and merges caller headers', async () => {
            fetchMock.mockResolvedValue(mockFetchResponse({ body: '{}' }));
            const { client } = createClient();

            await client.send({
                operation: 'test.headers',
                method: 'GET',
                url: 'https://example.test/h',
                headers: { 'x-custom': 'value' },
            });

            const init = fetchMock.mock.calls[0][1];
            expect(init.method).toBe('GET');
            expect(init.headers.accept).toBe('application/json');
            expect(init.headers['x-custom']).toBe('value');
            expect(init.signal).toBeInstanceOf(AbortSignal);
        });

        it('JSON-serialises object bodies', async () => {
            fetchMock.mockResolvedValue(mockFetchResponse({ body: '{}' }));
            const { client } = createClient();

            await client.send({
                operation: 'test.post-object',
                method: 'POST',
                url: 'https://example.test/post',
                headers: { 'content-type': 'application/json' },
                body: { hello: 'world' },
            });

            expect(fetchMock.mock.calls[0][1].body).toBe('{"hello":"world"}');
        });

        it('passes string bodies through unchanged', async () => {
            fetchMock.mockResolvedValue(mockFetchResponse({ body: '{}' }));
            const { client } = createClient();

            await client.send({
                operation: 'test.post-string',
                method: 'POST',
                url: 'https://example.test/post',
                body: 'raw-body',
            });

            expect(fetchMock.mock.calls[0][1].body).toBe('raw-body');
        });

        it('omits body when request.body is undefined', async () => {
            fetchMock.mockResolvedValue(mockFetchResponse({ body: '{}' }));
            const { client } = createClient();

            await client.send({
                operation: 'test.no-body',
                method: 'GET',
                url: 'https://example.test/get',
            });

            expect(fetchMock.mock.calls[0][1]).not.toHaveProperty('body');
        });

        it('forwards redirect when provided', async () => {
            fetchMock.mockResolvedValue(mockFetchResponse({ body: '{}' }));
            const { client } = createClient();

            await client.send({
                operation: 'test.redirect',
                method: 'GET',
                url: 'https://example.test/r',
                redirect: 'manual',
            });

            expect(fetchMock.mock.calls[0][1].redirect).toBe('manual');
        });

        it('propagates x-request-id from async request context', async () => {
            fetchMock.mockResolvedValue(mockFetchResponse({ body: '{}' }));
            const { client } = createClient();
            const context = createRequestContext({ requestId: 'req-char-fetch-01' });

            await runWithRequestContext(context, async () => {
                await client.send({
                    operation: 'test.request-id',
                    method: 'GET',
                    url: 'https://example.test/ctx',
                });
            });

            expect(fetchMock.mock.calls[0][1].headers[REQUEST_ID_HEADER]).toBe('req-char-fetch-01');
        });

        it('adds traceparent when a trace id is active', async () => {
            currentTraceIdSpy.mockReturnValue('0123456789abcdef0123456789abcdef');
            fetchMock.mockResolvedValue(mockFetchResponse({ body: '{}' }));
            const { client } = createClient();

            await client.send({
                operation: 'test.trace',
                method: 'GET',
                url: 'https://example.test/trace',
            });

            const traceparent = fetchMock.mock.calls[0][1].headers.traceparent;
            expect(traceparent).toMatch(/^00-0123456789abcdef0123456789abcdef-[0-9a-f]{16}-01$/);
        });
    });

    describe('HTTP error status handling', () => {
        it('throws ExternalServiceError for non-ok responses by default', async () => {
            fetchMock.mockResolvedValue(
                mockFetchResponse({
                    status: 502,
                    ok: false,
                    body: '{"error":"upstream"}',
                }),
            );
            const { client } = createClient();

            await expect(
                client.send({
                    operation: 'marketplace.fetch',
                    method: 'GET',
                    url: 'https://example.test/fail',
                }),
            ).rejects.toMatchObject({
                name: ExternalServiceError.name,
                message: 'Upstream returned an error response',
                safeDetails: { service: 'marketplace.fetch' },
            });
        });

        it('returns non-ok responses when returnErrorResponses is true', async () => {
            fetchMock.mockResolvedValue(
                mockFetchResponse({
                    status: 500,
                    ok: false,
                    body: '{"error":"boom"}',
                }),
            );
            const { client } = createClient();

            const result = await client.send({
                operation: 'webhook.deliver',
                method: 'POST',
                url: 'https://example.test/hook',
                returnErrorResponses: true,
            });

            expect(result.status).toBe(500);
            expect(result.ok).toBe(false);
            expect(result.body).toEqual({ error: 'boom' });
        });
    });

    describe('network failures and timeouts', () => {
        it('wraps generic fetch failures as ExternalServiceError', async () => {
            fetchMock.mockRejectedValue(new TypeError('fetch failed'));
            const { client } = createClient();

            await expect(
                client.send({
                    operation: 'test.network',
                    method: 'GET',
                    url: 'https://example.test/down',
                }),
            ).rejects.toMatchObject({
                name: ExternalServiceError.name,
                message: 'Outbound request failed',
                safeDetails: { service: 'test.network' },
            });
        });

        it('maps AbortError to ExternalServiceTimeoutError using the request timeout', async () => {
            fetchMock.mockImplementation((_url, init) => {
                return new Promise((_resolve, reject) => {
                    init.signal.addEventListener('abort', () => {
                        const error = new Error('The operation was aborted');
                        error.name = 'AbortError';
                        reject(error);
                    });
                });
            });
            const { client } = createClient({ timeoutMs: 20 });

            await expect(
                client.send({
                    operation: 'test.timeout',
                    method: 'POST',
                    url: 'https://example.test/slow',
                    timeoutMs: 15,
                }),
            ).rejects.toMatchObject({
                name: ExternalServiceTimeoutError.name,
                message: 'Upstream service timed out',
                safeDetails: { operation: 'test.timeout', timeoutMs: 15 },
            });
            expect(fetchMock).toHaveBeenCalledTimes(1);
        });
    });

    describe('retry policy (current contract)', () => {
        it('retries GET once after ExternalServiceTimeoutError, then succeeds', async () => {
            fetchMock
                .mockImplementationOnce((_url, init) => {
                    return new Promise((_resolve, reject) => {
                        init.signal.addEventListener('abort', () => {
                            const error = new Error('The operation was aborted');
                            error.name = 'AbortError';
                            reject(error);
                        });
                    });
                })
                .mockResolvedValueOnce(mockFetchResponse({ body: '{"ok":true}' }));

            const { client, logger } = createClient({ timeoutMs: 15 });

            const result = await client.send({
                operation: 'test.retry-get',
                method: 'GET',
                url: 'https://example.test/retry',
            });

            expect(result.body).toEqual({ ok: true });
            expect(fetchMock).toHaveBeenCalledTimes(2);
            expect(logger.warn).toHaveBeenCalledWith(
                { operation: 'test.retry-get', attempt: 1 },
                'Retrying idempotent request',
            );
        });

        it('retries HEAD once after timeout', async () => {
            fetchMock
                .mockImplementationOnce((_url, init) => {
                    return new Promise((_resolve, reject) => {
                        init.signal.addEventListener('abort', () => {
                            const error = new Error('The operation was aborted');
                            error.name = 'AbortError';
                            reject(error);
                        });
                    });
                })
                .mockResolvedValueOnce(mockFetchResponse({ body: '' }));

            const { client } = createClient({ timeoutMs: 15 });

            await client.send({
                operation: 'test.retry-head',
                method: 'HEAD',
                url: 'https://example.test/retry-head',
            });

            expect(fetchMock).toHaveBeenCalledTimes(2);
        });

        it('does not retry POST on timeout', async () => {
            fetchMock.mockImplementation((_url, init) => {
                return new Promise((_resolve, reject) => {
                    init.signal.addEventListener('abort', () => {
                        const error = new Error('The operation was aborted');
                        error.name = 'AbortError';
                        reject(error);
                    });
                });
            });
            const { client } = createClient({ timeoutMs: 15 });

            await expect(
                client.send({
                    operation: 'test.no-retry-post',
                    method: 'POST',
                    url: 'https://example.test/post',
                }),
            ).rejects.toBeInstanceOf(ExternalServiceTimeoutError);
            expect(fetchMock).toHaveBeenCalledTimes(1);
        });

        it('does not retry PUT on timeout despite IDEMPOTENT_METHODS membership (maxAttempts is 1)', async () => {
            // Characterises current behaviour: only GET/HEAD set maxAttempts=2.
            fetchMock.mockImplementation((_url, init) => {
                return new Promise((_resolve, reject) => {
                    init.signal.addEventListener('abort', () => {
                        const error = new Error('The operation was aborted');
                        error.name = 'AbortError';
                        reject(error);
                    });
                });
            });
            const { client } = createClient({ timeoutMs: 15 });

            await expect(
                client.send({
                    operation: 'test.no-retry-put',
                    method: 'PUT',
                    url: 'https://example.test/put',
                }),
            ).rejects.toBeInstanceOf(ExternalServiceTimeoutError);
            expect(fetchMock).toHaveBeenCalledTimes(1);
        });

        it('does not retry non-timeout ExternalServiceError for GET', async () => {
            fetchMock.mockResolvedValue(
                mockFetchResponse({
                    status: 503,
                    ok: false,
                    body: '{}',
                }),
            );
            const { client } = createClient();

            await expect(
                client.send({
                    operation: 'test.no-retry-status',
                    method: 'GET',
                    url: 'https://example.test/503',
                }),
            ).rejects.toBeInstanceOf(ExternalServiceError);
            expect(fetchMock).toHaveBeenCalledTimes(1);
        });
    });

    describe('logging', () => {
        it('logs outbound request and response at debug without changing the return contract', async () => {
            fetchMock.mockResolvedValue(mockFetchResponse({ body: '{"a":1}' }));
            const { client, logger } = createClient();

            await client.send({
                operation: 'test.log',
                method: 'GET',
                url: 'https://example.test/log?token=secret-value',
            });

            expect(logger.debug).toHaveBeenCalled();
            const requestLog = logger.debug.mock.calls.find((call) => call[1] === 'Outbound HTTP request');
            const responseLog = logger.debug.mock.calls.find((call) => call[1] === 'Outbound HTTP response');
            expect(requestLog).toBeDefined();
            expect(responseLog).toBeDefined();
            expect(requestLog[0].operation).toBe('test.log');
            expect(requestLog[0].method).toBe('GET');
            // Redaction must not leave raw secret query values in the logged URL.
            expect(String(requestLog[0].url)).not.toContain('secret-value');
        });
    });
});

describe('FetchHttpClient compatibility wrapper', () => {
    /** @type {ReturnType<typeof vi.fn>} */
    let fetchMock;

    beforeEach(() => {
        fetchMock = vi.fn();
        vi.stubGlobal('fetch', fetchMock);
        vi.spyOn(tracing, 'currentTraceId').mockReturnValue(undefined);
    });

    afterEach(() => {
        vi.unstubAllGlobals();
        vi.restoreAllMocks();
    });

    it('constructs with { config, logger } and exposes send matching the factory', async () => {
        fetchMock.mockResolvedValue(mockFetchResponse({ body: '{"via":"wrapper"}' }));
        const logger = createLogger();
        const deps = { config: { timeoutMs: 5_000 }, logger };

        const viaFactory = createFetchHttpClient(deps);
        const viaWrapper = new FetchHttpClient(deps);

        expect(typeof viaWrapper.send).toBe('function');
        const factoryResult = await viaFactory.send({
            operation: 'parity.factory',
            method: 'GET',
            url: 'https://example.test/parity-factory',
        });
        const wrapperResult = await viaWrapper.send({
            operation: 'parity.wrapper',
            method: 'GET',
            url: 'https://example.test/parity-wrapper',
        });

        expect(factoryResult.body).toEqual({ via: 'wrapper' });
        expect(wrapperResult.body).toEqual({ via: 'wrapper' });
        expect(factoryResult.ok).toBe(true);
        expect(wrapperResult.ok).toBe(true);
        expect(fetchMock).toHaveBeenCalledTimes(2);
    });

    it('does not share logger child state across separately constructed clients', async () => {
        fetchMock.mockResolvedValue(mockFetchResponse({ body: '{}' }));
        const loggerA = createLogger();
        const loggerB = createLogger();

        const clientA = createFetchHttpClient({ config: { timeoutMs: 5_000 }, logger: loggerA });
        const clientB = new FetchHttpClient({ config: { timeoutMs: 5_000 }, logger: loggerB });

        await clientA.send({
            operation: 'isolate.a',
            method: 'GET',
            url: 'https://example.test/a',
        });
        await clientB.send({
            operation: 'isolate.b',
            method: 'GET',
            url: 'https://example.test/b',
        });

        expect(loggerA.debug).toHaveBeenCalled();
        expect(loggerB.debug).toHaveBeenCalled();
        expect(loggerA.debug.mock.calls.some((call) => call[0]?.operation === 'isolate.a')).toBe(true);
        expect(loggerB.debug.mock.calls.some((call) => call[0]?.operation === 'isolate.b')).toBe(true);
        expect(loggerA.debug.mock.calls.some((call) => call[0]?.operation === 'isolate.b')).toBe(false);
        expect(loggerB.debug.mock.calls.some((call) => call[0]?.operation === 'isolate.a')).toBe(false);
    });

    it('preserves POST no-retry timeout behavior through the wrapper', async () => {
        fetchMock.mockImplementation((_url, init) => {
            return new Promise((_resolve, reject) => {
                init.signal.addEventListener('abort', () => {
                    const error = new Error('The operation was aborted');
                    error.name = 'AbortError';
                    reject(error);
                });
            });
        });
        const client = new FetchHttpClient({
            config: { timeoutMs: 15 },
            logger: createLogger(),
        });

        await expect(
            client.send({
                operation: 'wrapper.no-retry-post',
                method: 'POST',
                url: 'https://example.test/post',
            }),
        ).rejects.toBeInstanceOf(ExternalServiceTimeoutError);
        expect(fetchMock).toHaveBeenCalledTimes(1);
    });
});
