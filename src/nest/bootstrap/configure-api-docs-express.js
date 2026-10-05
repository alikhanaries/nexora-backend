import { readFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '../../..');

/**
 * @param {import('express').Express} expressApp
 * @param {ReturnType<import('../../app/config/index.js').loadConfigFromEnvironment>} config
 */
export function configureApiDocsExpress(expressApp, config) {
  if (!config.docsEnabled) {
    return;
  }

  const snapshotPath = join(repoRoot, 'docs/.openapi-snapshot.json');
  let openApiDocument = {
    openapi: '3.1.0',
    info: { title: `${config.appName} API`, version: '0.1.0' },
    paths: {},
  };
  if (existsSync(snapshotPath)) {
    try {
      openApiDocument = JSON.parse(readFileSync(snapshotPath, 'utf8'));
    } catch {
      // keep minimal document
    }
  }

  const sendSpec = (_req, res) => {
    res.json(openApiDocument);
  };

  expressApp.get('/openapi.json', sendSpec);
  expressApp.get('/api-docs.json', sendSpec);
  expressApp.get('/api-docs', (_req, res) => {
    res.redirect(302, '/docs');
  });

  expressApp.get('/docs', (_req, res) => {
    res.type('html').send(`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <title>${config.appName} API docs</title>
  <meta name="viewport" content="width=device-width, initial-scale=1" />
</head>
<body>
  <script id="api-reference" data-url="/openapi.json"></script>
  <script src="https://cdn.jsdelivr.net/npm/@scalar/api-reference"></script>
</body>
</html>`);
  });
}
