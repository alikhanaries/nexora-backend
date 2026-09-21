import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';

/**
 * Minimal native API surface for Phase 1 verification.
 *
 * No business behaviour — only enough to prove validation, OpenAPI generation
 * and the request pipeline work end-to-end.
 */
const echoBodySchema = z.object({
  message: z.string().min(1).max(256),
});

const foundationRoutes: FastifyPluginAsync = async (app) => {
  const typed = app.withTypeProvider<ZodTypeProvider>();

  typed.get(
    '/api/v1/foundation/ping',
    {
      schema: {
        tags: ['Foundation'],
        summary: 'Foundation liveness probe for the native API',
        response: {
          200: z.object({
            success: z.literal(true),
            data: z.object({ message: z.literal('pong') }),
          }),
        },
      },
    },
    async () => ({
      success: true as const,
      data: { message: 'pong' as const },
    }),
  );

  typed.post(
    '/api/v1/foundation/echo',
    {
      schema: {
        tags: ['Foundation'],
        summary: 'Echoes a validated payload',
        body: echoBodySchema,
        response: {
          200: z.object({
            success: z.literal(true),
            data: echoBodySchema,
          }),
        },
      },
    },
    async (request) => ({
      success: true as const,
      data: request.body,
    }),
  );
  await Promise.resolve();
};

export default foundationRoutes;
