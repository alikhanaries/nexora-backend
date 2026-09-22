import { describe, expect, it } from 'vitest';
import {
    DefaultExternalIntegerIdMappingCommandService,
    DefaultExternalIntegerIdMappingQueryService,
    ExternalIdMappingProvider,
    ExternalIdMappingResourceType,
} from '../../../src/modules/external-id-mapping/public/index.js';
import { createExternalIdMappingModule } from '../../../src/modules/external-id-mapping/index.js';

describe('external integer ID mapping public contracts', () => {
    it('exposes command and query services without leaking the repository', () => {
        const module = createExternalIdMappingModule({
            database: {
                execute: async () => {
                    throw new Error('not used');
                },
            },
        });

        expect(module.externalIntegerIdMappingCommandService).toBeInstanceOf(
            DefaultExternalIntegerIdMappingCommandService,
        );
        expect(module.externalIntegerIdMappingQueryService).toBeInstanceOf(
            DefaultExternalIntegerIdMappingQueryService,
        );
        expect(module).not.toHaveProperty('mappings');
        expect(module).not.toHaveProperty('assignExternalIntegerIdMapping');
    });

    it('exports provider-neutral namespace constants from the public barrel', () => {
        expect(ExternalIdMappingProvider.COMPAT_V2).toBe('compat_v2');
        expect(ExternalIdMappingResourceType.ORDER).toBe('order');
        expect(ExternalIdMappingResourceType.ORDER_LINE).toBe('order_line');
        expect(ExternalIdMappingResourceType.SHIPMENT).toBe('shipment');
        expect(ExternalIdMappingResourceType.CANCELLATION).toBe('cancellation');
        expect(ExternalIdMappingResourceType.RETURN).toBe('return');
    });
});
