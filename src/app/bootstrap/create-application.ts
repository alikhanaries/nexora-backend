import type { HttpServer } from '../http/types.js';
import { createHttpServer } from '../http/create-server.js';
import { createDefaultProbes, ReadinessService } from '../observability/readiness.js';
import type { Infrastructure } from './create-infrastructure.js';

export interface Application {
  readonly infra: Infrastructure;
  readonly readiness: ReadinessService;
  readonly httpServer: HttpServer;
}

export async function createApplication(infra: Infrastructure): Promise<Application> {
  const readiness = new ReadinessService(
    createDefaultProbes({
      database: infra.database,
      redis: infra.redis,
      queue: infra.queue,
      storage: infra.storage,
    }),
  );

  const httpServer = await createHttpServer({
    config: infra.config,
    logger: infra.logger,
    metrics: infra.metrics,
    readiness,
  });

  return { infra, readiness, httpServer };
}
