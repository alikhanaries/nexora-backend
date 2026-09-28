import { describe, expect, it } from 'vitest';
import {
    buildCeMutationEnvelope,
    mapCeProductItemToUpsertCommands,
    mapProductToCeCatalogItem,
    mergeCeExtraDataAttributes,
} from '../../../src/modules/compatibility/application/mappers/compatibility-catalog-product.mapper.js';

describe('compatibility catalog product mapper', () => {
    it('maps CE product item to upsert commands', () => {
        const mapped = mapCeProductItemToUpsertCommands({
            MerchantProductNo: ' SKU-1 ',
            Name: 'Title',
            Description: 'Desc',
            Brand: 'BrandX',
            ExtraData: { foo: 'bar' },
        });
        expect(mapped).toEqual({
            merchantSku: 'SKU-1',
            locale: 'en',
            title: 'Title',
            description: 'Desc',
            brand: 'BrandX',
            extraData: { foo: 'bar' },
            externalReferenceFromExtra: '{"foo":"bar"}',
        });
    });

    it('merges extra data into ceExtraData attributes', () => {
        const merged = mergeCeExtraDataAttributes({ other: 1, ceExtraData: { a: '1' } }, { b: '2' });
        expect(merged).toEqual({
            other: 1,
            ceExtraData: { a: '1', b: '2' },
        });
    });

    it('maps Nexora product to CE catalog item', () => {
        const item = mapProductToCeCatalogItem(
            { merchantSku: 'SKU-1' },
            {
                title: 'T',
                description: 'D',
                brand: 'B',
                attributes: { ceExtraData: { k: 'v' } },
            },
        );
        expect(item).toEqual({
            MerchantProductNo: 'SKU-1',
            Name: 'T',
            Description: 'D',
            Brand: 'B',
            ExtraData: { k: 'v' },
        });
    });

    it('builds CE mutation envelope', () => {
        expect(buildCeMutationEnvelope(true, [{ Success: true }])).toEqual({
            Success: true,
            Message: null,
            ValidationErrors: {},
            Content: [{ Success: true }],
        });
    });
});
