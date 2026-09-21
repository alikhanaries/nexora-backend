import { describe, expect, it } from 'vitest';
import { clampBatchSize } from '../../src/shared/pagination/index.js';

describe('pagination batch sizing', () => {
  it('clamps invalid values to safe bounds', () => {
    expect(clampBatchSize(0)).toBe(1);
    expect(clampBatchSize(10_000)).toBe(1000);
    expect(clampBatchSize(50)).toBe(50);
  });
});
