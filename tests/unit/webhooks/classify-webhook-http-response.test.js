import { describe, expect, it } from 'vitest';
import { classifyWebhookHttpResponse, parseRetryAfterSeconds } from '../../../src/modules/webhooks/application/classify-webhook-http-response.js';

describe('classifyWebhookHttpResponse', () => {
    it('treats 2xx responses as success', () => {
        expect(classifyWebhookHttpResponse(200)).toEqual({ outcome: 'success', retryable: false });
        expect(classifyWebhookHttpResponse(204)).toEqual({ outcome: 'success', retryable: false });
    });

    it('treats retryable statuses as retryable failures', () => {
        for (const status of [408, 425, 429, 500, 502, 503, 504]) {
            expect(classifyWebhookHttpResponse(status)).toEqual({ outcome: 'retryable_failure', retryable: true });
        }
    });

    it('treats common permanent 4xx responses as permanent failures', () => {
        for (const status of [400, 401, 403, 404, 410, 422]) {
            expect(classifyWebhookHttpResponse(status)).toEqual({ outcome: 'permanent_failure', retryable: false });
        }
    });

    it('treats redirects as permanent failures', () => {
        expect(classifyWebhookHttpResponse(302)).toEqual({ outcome: 'permanent_failure', retryable: false });
    });
});

describe('parseRetryAfterSeconds', () => {
    it('parses integer Retry-After values', () => {
        expect(parseRetryAfterSeconds({ 'retry-after': '30' })).toBe(30);
    });
});
