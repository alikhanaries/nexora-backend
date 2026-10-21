import { describe, expect, it, vi } from 'vitest';
import { createAuditModule } from '../../../src/modules/audit/index.js';

describe('createAuditModule', () => {
    it('wires function-based recorder and list service', () => {
        const module = createAuditModule({
            database: { execute: vi.fn() },
        });

        expect(typeof module.auditRecorder.record).toBe('function');
        expect(typeof module.auditService.listEvents).toBe('function');
        expect(module.routes).toBeUndefined();
    });
});
