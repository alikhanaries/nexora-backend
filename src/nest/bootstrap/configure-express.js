import express from 'express';
import helmet from 'helmet';
import { createHmac } from 'node:crypto';
import { configureApiDocsExpress } from './configure-api-docs-express.js';
import {
  createRequestContext,
  enterRequestContext,
  enrichRequestContext,
} from '../../shared/context/request-context.js';
import { REQUEST_ID_HEADER, resolveRequestId } from '../../shared/context/request-id.js';
import { currentTraceId } from '../../infrastructure/observability/tracing.js';

export const MARKETPLACE_WEBHOOK_PATH_SEGMENT = '/api/v1/inbound/marketplace-webhooks/';

/**
 * @param {string} path
 */
export function isMarketplaceWebhookIngressPath(path) {
  return path.includes(MARKETPLACE_WEBHOOK_PATH_SEGMENT);
}

/**
 * Capture the exact request bytes for marketplace webhook signature verification.
 * Must run before express.json() on matching paths.
 *
 * @returns {import('express').RequestHandler}
 */
export function marketplaceWebhookRawBodyMiddleware() {
  return (req, res, next) => {
    const path = req.path ?? req.url.split('?')[0] ?? '';
    if (!isMarketplaceWebhookIngressPath(path)) {
      next();
      return;
    }

    const chunks = [];
    req.on('data', (chunk) => {
      chunks.push(typeof chunk === 'string' ? Buffer.from(chunk) : chunk);
    });
    req.on('error', next);
    req.on('end', () => {
      const buffer = Buffer.concat(chunks);
      req.marketplaceWebhookRawBody = buffer.toString('utf8');
      req.rawBodyBuffer = buffer;
      next();
    });
  };
}

/**
 * @param {import('express').Express} expressApp
 * @param {ReturnType<import('../../app/config/index.js').loadConfigFromEnvironment>} config
 */
/**
 * @param {ReturnType<import('../../app/config/index.js').loadConfigFromEnvironment>} config
 * @returns {import('express').RequestHandler}
 */
export function requestContextExpressMiddleware(config) {
  return (req, res, next) => {
    const requestId = resolveRequestId(
      req.headers[REQUEST_ID_HEADER],
      config.server.trustIncomingRequestId,
    );
    res.setHeader(REQUEST_ID_HEADER, requestId);

    const context = createRequestContext({
      requestId,
      ip: req.ip,
      userAgent: req.headers['user-agent'],
    });
    enterRequestContext(context);

    const traceId = currentTraceId();
    if (traceId !== undefined) {
      enrichRequestContext({ traceId });
    }

    next();
  };
}

/**
 * @param {import('express').Express} expressApp
 * @param {ReturnType<import('../../app/config/index.js').loadConfigFromEnvironment>} config
 * @param {object} [metrics]
 */
export function configureExpress(expressApp, config, metrics) {
  expressApp.set('trust proxy', config.server.trustProxy);

  expressApp.use(helmet({ contentSecurityPolicy: false }));
  configureApiDocsExpress(expressApp, config);

  if (metrics !== undefined && config.observability.metricsEnabled) {
    expressApp.get('/internal/metrics', async (_req, res) => {
      try {
        const body = await metrics.render();
        res.setHeader('content-type', metrics.contentType);
        res.send(body);
      } catch {
        res.status(500).send('');
      }
    });
  }

  expressApp.use(requestContextExpressMiddleware(config));
  expressApp.use(marketplaceWebhookRawBodyMiddleware());

  expressApp.use((req, res, next) => {
    const path = req.path ?? req.url.split('?')[0] ?? '';
    if (isMarketplaceWebhookIngressPath(path)) {
      next();
      return;
    }
    express.json({ limit: config.server.bodyLimitBytes })(req, res, next);
  });

  if (config.security.corsEnabled) {
    const allowed = new Set(config.security.allowedOrigins);
    expressApp.use((req, res, next) => {
      const origin = req.headers.origin;
      if (typeof origin === 'string' && allowed.has(origin)) {
        res.setHeader('Access-Control-Allow-Origin', origin);
        res.setHeader('Access-Control-Allow-Credentials', 'true');
        res.setHeader('Vary', 'Origin');
      }
      if (req.method === 'OPTIONS') {
        res.setHeader('Access-Control-Allow-Methods', 'GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS');
        res.setHeader(
          'Access-Control-Allow-Headers',
          'Content-Type, Authorization, x-api-key, X-Request-Id',
        );
        res.status(204).end();
        return;
      }
      next();
    });
  }
}

/**
 * Verify Shopify-style HMAC over raw body (used in tests; production uses existing adapter).
 *
 * @param {{ rawBody: string, secret: string, hmacHeader: string }} input
 */
export function verifyShopifyStyleHmac(input) {
  const digest = createHmac('sha256', input.secret).update(input.rawBody, 'utf8').digest('base64');
  return digest === input.hmacHeader;
}
