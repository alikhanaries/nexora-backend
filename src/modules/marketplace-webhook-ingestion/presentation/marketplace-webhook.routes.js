import { z } from 'zod';
import { getRequestContext } from '../../../shared/context/request-context.js';

const webhookResponseSchema = z.object({
    success: z.literal(true),
    data: z.object({
        outcome: z.string(),
        externalOrderReference: z.string().nullable(),
    }),
    replayed: z.boolean(),
});

/**
 * @param {object} deps
 * @param {import('../application/receive-marketplace-webhook.js').ReceiveMarketplaceWebhook} deps.receiveMarketplaceWebhook
 */
export function createMarketplaceWebhookRoutes(deps) {
    return async function marketplaceWebhookRoutes(app) {
        app.addHook('preParsing', async (request, _reply, payload) => {
            const path = request.url.split('?')[0] ?? '';
            if (!path.includes('/api/v1/inbound/marketplace-webhooks/')) {
                return payload;
            }
            const chunks = [];
            for await (const chunk of payload) {
                chunks.push(typeof chunk === 'string' ? Buffer.from(chunk) : chunk);
            }
            const buffer = Buffer.concat(chunks);
            request.marketplaceWebhookRawBody = buffer.toString('utf8');
            return buffer;
        });
        const typed = app.withTypeProvider();
        typed.post('/api/v1/inbound/marketplace-webhooks/:ingressToken', {
            schema: {
                tags: ['Marketplace Webhooks'],
                summary: 'Receive inbound marketplace webhook (provider-neutral ingress)',
                params: z.object({
                    ingressToken: z.string().min(16).max(128),
                }),
                response: { 200: webhookResponseSchema },
            },
        }, async (request) => {
            const correlationId = getRequestContext()?.requestId ?? null;
            const rawBody = request.marketplaceWebhookRawBody ?? '';
            const headers = {};
            for (const [key, value] of Object.entries(request.headers)) {
                if (value === undefined) {
                    continue;
                }
                headers[key.toLowerCase()] = value;
            }
            const result = await deps.receiveMarketplaceWebhook.execute({
                ingressToken: request.params.ingressToken,
                headers,
                rawBody,
                correlationId,
            });
            return {
                success: true,
                data: result.data,
                replayed: result.replayed,
            };
        });
        await Promise.resolve();
    };
}
