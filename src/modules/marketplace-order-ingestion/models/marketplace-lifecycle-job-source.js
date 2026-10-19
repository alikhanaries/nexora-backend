/** How a marketplace lifecycle job entered the queue. */
export const MarketplaceLifecycleJobSource = Object.freeze({
    WEBHOOK: 'webhook',
    POLLING: 'polling',
    OUTBOUND: 'outbound',
    MANUAL: 'manual',
});
