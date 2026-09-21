import { describe, expect, it } from 'vitest';
import {
  createRequestContext,
  enrichRequestContext,
  getRequestContext,
  runWithRequestContext,
} from '../../src/shared/context/request-context.js';
import {
  generateRequestId,
  isValidRequestId,
  resolveRequestId,
} from '../../src/shared/context/request-id.js';

describe('request context', () => {
  it('generates a valid request id', () => {
    const id = generateRequestId();
    expect(isValidRequestId(id)).toBe(true);
  });

  it('does not trust incoming ids by default', () => {
    const resolved = resolveRequestId('evil-id', false);
    expect(resolved).not.toBe('evil-id');
  });

  it('propagates context through async work', async () => {
    const context = createRequestContext({ requestId: 'ctx-1' });
    await runWithRequestContext(context, async () => {
      enrichRequestContext({ tenantId: '00000000-0000-0000-0000-000000000001' });
      await Promise.resolve();
      expect(getRequestContext()?.requestId).toBe('ctx-1');
      expect(getRequestContext()?.tenantId).toBe('00000000-0000-0000-0000-000000000001');
    });
  });
});
