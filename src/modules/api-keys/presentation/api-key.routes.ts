import type { FastifyPluginAsync } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { z } from 'zod';
import { requireActorContext } from '../../../shared/context/require-principal.js';
import type { CreateApiKeyUseCase } from '../application/use-cases/create-api-key.js';
import type { ListApiKeysUseCase } from '../application/use-cases/list-api-keys.js';
import type { RevokeApiKeyUseCase } from '../application/use-cases/revoke-api-key.js';
import type { RotateApiKeyUseCase } from '../application/use-cases/rotate-api-key.js';

export interface ApiKeyRoutesOptions {
  readonly createApiKey: CreateApiKeyUseCase;
  readonly rotateApiKey: RotateApiKeyUseCase;
  readonly revokeApiKey: RevokeApiKeyUseCase;
  readonly listApiKeys: ListApiKeysUseCase;
}

const apiKeySummarySchema = z.object({
  id: z.string().uuid(),
  tenantId: z.string().uuid(),
  name: z.string(),
  prefix: z.string(),
  keyType: z.enum(['STANDARD', 'INTEGRATION']),
  scopes: z.array(z.string()),
  status: z.enum(['ACTIVE', 'REVOKED', 'EXPIRED']),
  expiresAt: z.string().nullable(),
  lastUsedAt: z.string().nullable(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

const createBodySchema = z.object({
  name: z.string().min(1).max(128),
  scopes: z.array(z.string().min(1)).min(1),
  keyType: z.enum(['STANDARD', 'INTEGRATION']).optional(),
  expiresAt: z.string().optional(),
});

const apiKeyRoutes: FastifyPluginAsync<ApiKeyRoutesOptions> = async (app, options) => {
  const typed = app.withTypeProvider<ZodTypeProvider>();

  typed.get(
    '/api/v1/api-keys',
    {
      schema: {
        tags: ['API Keys'],
        summary: 'List API keys for the current tenant',
        response: {
          200: z.object({
            success: z.literal(true),
            data: z.array(apiKeySummarySchema),
          }),
        },
      },
    },
    async () => {
      const actor = requireActorContext();
      const keys = await options.listApiKeys.execute({
        tenantId: actor.tenantId,
        actorPermissions: actor.permissions,
      });

      return {
        success: true as const,
        data: keys.map((key) => ({
          id: key.id,
          tenantId: key.tenantId,
          name: key.name,
          prefix: key.prefix,
          keyType: key.keyType,
          scopes: [...key.scopes],
          status: key.status,
          expiresAt: key.expiresAt?.toISOString() ?? null,
          lastUsedAt: key.lastUsedAt?.toISOString() ?? null,
          createdAt: key.createdAt.toISOString(),
          updatedAt: key.updatedAt.toISOString(),
        })),
      };
    },
  );

  typed.post(
    '/api/v1/api-keys',
    {
      schema: {
        tags: ['API Keys'],
        summary: 'Create an API key (secret shown once)',
        body: createBodySchema,
        response: {
          201: z.object({
            success: z.literal(true),
            data: z.object({
              id: z.string().uuid(),
              name: z.string(),
              prefix: z.string(),
              secret: z.string(),
              scopes: z.array(z.string()),
              keyType: z.enum(['STANDARD', 'INTEGRATION']),
              expiresAt: z.string().nullable(),
            }),
          }),
        },
      },
    },
    async (request, reply) => {
      const actor = requireActorContext();
      const result = await options.createApiKey.execute({
        tenantId: actor.tenantId,
        actorId: actor.userId ?? actor.tenantId,
        actorPermissions: actor.permissions,
        name: request.body.name,
        scopes: request.body.scopes,
        ...(request.body.keyType === undefined ? {} : { keyType: request.body.keyType }),
        expiresAt: request.body.expiresAt === undefined ? null : new Date(request.body.expiresAt),
      });

      return reply.status(201).send({
        success: true as const,
        data: {
          id: result.id,
          name: result.name,
          prefix: result.prefix,
          secret: result.secret,
          scopes: [...result.scopes],
          keyType: result.keyType,
          expiresAt: result.expiresAt?.toISOString() ?? null,
        },
      });
    },
  );

  typed.post(
    '/api/v1/api-keys/:apiKeyId/rotate',
    {
      schema: {
        tags: ['API Keys'],
        summary: 'Rotate an API key (requires step-up; secret shown once)',
        params: z.object({ apiKeyId: z.string().uuid() }),
        response: {
          200: z.object({
            success: z.literal(true),
            data: z.object({
              id: z.string().uuid(),
              prefix: z.string(),
              secret: z.string(),
              rotatedFromId: z.string().uuid(),
            }),
          }),
        },
      },
    },
    async (request) => {
      const actor = requireActorContext();
      if (actor.sessionId === undefined) {
        throw new Error('Session is required for API key rotation');
      }

      const result = await options.rotateApiKey.execute({
        tenantId: actor.tenantId,
        actorId: actor.userId ?? actor.tenantId,
        actorPermissions: actor.permissions,
        sessionId: actor.sessionId,
        apiKeyId: request.params.apiKeyId,
      });

      return {
        success: true as const,
        data: result,
      };
    },
  );

  typed.post(
    '/api/v1/api-keys/:apiKeyId/revoke',
    {
      schema: {
        tags: ['API Keys'],
        summary: 'Revoke an API key',
        params: z.object({ apiKeyId: z.string().uuid() }),
        response: {
          200: z.object({
            success: z.literal(true),
            data: z.object({ revoked: z.literal(true) }),
          }),
        },
      },
    },
    async (request) => {
      const actor = requireActorContext();
      await options.revokeApiKey.execute({
        tenantId: actor.tenantId,
        actorId: actor.userId ?? actor.tenantId,
        actorPermissions: actor.permissions,
        apiKeyId: request.params.apiKeyId,
      });

      return { success: true as const, data: { revoked: true as const } };
    },
  );

  await Promise.resolve();
};

export default apiKeyRoutes;
