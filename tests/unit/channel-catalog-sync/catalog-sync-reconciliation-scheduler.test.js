import { describe, expect, it, vi } from 'vitest';
import { CatalogSyncReconciliationScheduler } from '../../../src/modules/channel-catalog-sync/application/catalog-sync-reconciliation-scheduler.js';

describe('CatalogSyncReconciliationScheduler', () => {
    it('does not start when disabled', () => {
        const service = { run: vi.fn() };
        const scheduler = new CatalogSyncReconciliationScheduler(
            service,
            { withLock: vi.fn() },
            { enabled: false, intervalMs: 60_000 },
            { info: vi.fn() },
            300,
        );
        scheduler.start();
        expect(scheduler.timer).toBeUndefined();
    });

    it('tick runs service under lock when enabled', async () => {
        const service = { run: vi.fn().mockResolvedValue({ outcome: 'success' }) };
        const lock = {
            withLock: vi.fn(async (_key, _ttl, fn) => fn()),
        };
        const scheduler = new CatalogSyncReconciliationScheduler(
            service,
            lock,
            { enabled: true, intervalMs: 60_000 },
            { info: vi.fn(), debug: vi.fn(), error: vi.fn() },
            300,
        );
        await scheduler.tick();
        expect(lock.withLock).toHaveBeenCalledWith('catalog-sync-reconciliation', 300, expect.any(Function));
        expect(service.run).toHaveBeenCalled();
    });
});
