/**
 * Outbound HTTP port.
 *
 * Every call to a third party goes through this interface so timeouts,
 * redacted logging, error normalisation and trace propagation are applied
 * uniformly. Calling `fetch` directly from a module is a boundary violation.
 *
 * Phase 1 implements timeout, logging, error normalisation and trace
 * propagation only. Retry, circuit breaking and provider-side rate limiting
 * are deliberately absent: they need per-provider policy that does not exist
 * yet, and blind retries amplify outages.
 */

export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE' | 'HEAD';

export interface HttpRequest {
  readonly method: HttpMethod;
  readonly url: string;
  readonly headers?: Readonly<Record<string, string>> | undefined;
  /** Serialised as JSON unless a `content-type` header says otherwise. */
  readonly body?: unknown;
  readonly timeoutMs?: number | undefined;
  /** Low-cardinality label for logs and metrics, e.g. `bol.get_orders`. */
  readonly operation: string;
}

export interface HttpResponse {
  readonly status: number;
  readonly headers: Readonly<Record<string, string>>;
  readonly body: unknown;
  readonly durationMs: number;
}

export interface HttpClient {
  /**
   * @throws {TimeoutError} the request exceeded its deadline.
   * @throws {ExternalServiceError} transport failure or a non-2xx response.
   */
  send(request: HttpRequest): Promise<HttpResponse>;
}
