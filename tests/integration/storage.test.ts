import { afterAll, describe, expect, it } from 'vitest';
import { closeTestInfrastructure, getTestInfrastructure } from './helpers.js';

describe('object storage integration', () => {
  afterAll(async () => {
    await closeTestInfrastructure();
  });

  it('uploads, checks existence, reads and deletes objects', async () => {
    const infra = await getTestInfrastructure();
    const key = `tests/${Date.now()}.txt`;
    const body = Buffer.from('phase-1');

    await infra.storage.put({
      key,
      body,
      contentType: 'text/plain',
      contentLength: body.length,
    });

    expect(await infra.storage.exists({ key })).toBe(true);

    const object = await infra.storage.get({ key });
    const chunks: Buffer[] = [];
    for await (const chunk of object.body) {
      chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk as Uint8Array));
    }
    expect(Buffer.concat(chunks).toString()).toBe('phase-1');

    await infra.storage.delete({ key });
    expect(await infra.storage.exists({ key })).toBe(false);
  });
});
