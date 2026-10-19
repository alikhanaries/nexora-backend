import { describe, expect, it } from 'vitest';
import { stockConnectOk } from '../../../src/modules/erp/stock-connect/controllers/nest/stock-connect.envelope.js';

describe('stockConnectOk', () => {
  it('wraps data in the StockConnect integration envelope', () => {
    expect(stockConnectOk({ message: 'pong' })).toEqual({
      success: true,
      integration: 'stock-connect',
      data: { message: 'pong' },
    });
  });
});
