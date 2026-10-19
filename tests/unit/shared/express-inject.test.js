import express from 'express';
import { describe, expect, it } from 'vitest';
import { injectExpress } from '../../../src/shared/http/express-inject.js';

describe('injectExpress', () => {
  it('issues an in-process request against an Express app', async () => {
    const app = express();
    app.get('/ping', (_req, res) => {
      res.status(200).json({ ok: true });
    });

    const response = await injectExpress(app, { method: 'GET', url: '/ping' });
    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ ok: true });
  });
});
