import type { HttpClientConfig } from '../../shared/config/index.js';
import { getRequestContext } from '../../shared/context/request-context.js';
import { REQUEST_ID_HEADER } from '../../shared/context/request-id.js';
import { ExternalServiceError, ExternalServiceTimeoutError } from '../../shared/errors/index.js';
import type { HttpClient, HttpRequest, HttpResponse } from '../../shared/http/index.js';
import type { Logger } from '../../shared/logging/index.js';
import { redactDeep, redactUrl } from '../../shared/logging/index.js';
import { currentTraceId } from '../observability/tracing.js';

export interface FetchHttpClientOptions {
  readonly config: HttpClientConfig;
  readonly logger: Logger;
}

const IDEMPOTENT_METHODS = new Set(['GET', 'HEAD', 'PUT', 'DELETE']);

/**
 * Central outbound HTTP client.
 *
 * Retries are opt-in and limited to idempotent methods. POST is never retried
 * automatically.
 */
export class FetchHttpClient implements HttpClient {
  private readonly logger: Logger;
  private readonly defaultTimeoutMs: number;

  constructor({ config, logger }: FetchHttpClientOptions) {
    this.logger = logger.child({ component: 'http-client' });
    this.defaultTimeoutMs = config.timeoutMs;
  }

  async send(request: HttpRequest): Promise<HttpResponse> {
    const maxAttempts = request.method === 'GET' || request.method === 'HEAD' ? 2 : 1;
    let lastError: unknown;

    for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
      try {
        return await this.sendOnce(request);
      } catch (error) {
        lastError = error;
        const retryable =
          IDEMPOTENT_METHODS.has(request.method) &&
          attempt < maxAttempts &&
          error instanceof ExternalServiceTimeoutError;
        if (!retryable) throw error;
        this.logger.warn({ operation: request.operation, attempt }, 'Retrying idempotent request');
      }
    }

    throw lastError;
  }

  private async sendOnce(request: HttpRequest): Promise<HttpResponse> {
    const timeoutMs = request.timeoutMs ?? this.defaultTimeoutMs;
    const controller = new AbortController();
    const timer = setTimeout(() => {
      controller.abort();
    }, timeoutMs);

    const headers: Record<string, string> = {
      accept: 'application/json',
      ...(request.headers ?? {}),
    };

    const context = getRequestContext();
    if (context !== undefined) {
      headers[REQUEST_ID_HEADER] = context.requestId;
    }
    const traceId = currentTraceId();
    if (traceId !== undefined) {
      headers['traceparent'] = `00-${traceId}-${randomSpanId()}-01`;
    }

    const startedAt = Date.now();
    const body = serializeRequestBody(request.body, headers);

    this.logger.debug(
      {
        operation: request.operation,
        method: request.method,
        url: redactUrl(request.url),
        headers: redactDeep(headers),
      },
      'Outbound HTTP request',
    );

    try {
      const response = await fetch(request.url, {
        method: request.method,
        headers,
        ...(body === undefined ? {} : { body }),
        signal: controller.signal,
      });

      const durationMs = Date.now() - startedAt;
      const responseHeaders = headersToRecord(response.headers);
      const parsedBody = await parseBody(response);

      this.logger.debug(
        {
          operation: request.operation,
          status: response.status,
          durationMs,
          body: redactDeep(parsedBody),
        },
        'Outbound HTTP response',
      );

      if (!response.ok) {
        throw new ExternalServiceError(request.operation, 'Upstream returned an error response');
      }

      return {
        status: response.status,
        headers: responseHeaders,
        body: parsedBody,
        durationMs,
      };
    } catch (error) {
      if (error instanceof ExternalServiceError) throw error;
      if (error instanceof Error && error.name === 'AbortError') {
        throw new ExternalServiceTimeoutError(request.operation, timeoutMs, error);
      }
      throw new ExternalServiceError(request.operation, 'Outbound request failed', error);
    } finally {
      clearTimeout(timer);
    }
  }
}

async function parseBody(response: Response): Promise<unknown> {
  const contentType = response.headers.get('content-type') ?? '';
  const text = await response.text();
  if (text.length === 0) return null;
  if (contentType.includes('application/json')) {
    try {
      return JSON.parse(text) as unknown;
    } catch {
      return text;
    }
  }
  return text;
}

function headersToRecord(headers: Headers): Readonly<Record<string, string>> {
  const result: Record<string, string> = {};
  headers.forEach((value, key) => {
    result[key] = value;
  });
  return result;
}

function serializeRequestBody(body: unknown, headers: Record<string, string>): string | undefined {
  if (body === undefined) return undefined;
  if (typeof body === 'string') return body;
  const contentType = headers['content-type'] ?? headers['Content-Type'] ?? '';
  if (contentType.includes('application/json') || typeof body === 'object') {
    return JSON.stringify(body);
  }
  if (typeof body === 'number' || typeof body === 'boolean' || typeof body === 'bigint') {
    return String(body);
  }
  return undefined;
}

function randomSpanId(): string {
  return Math.random().toString(16).slice(2, 18).padEnd(16, '0');
}
