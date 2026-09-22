import { RateLimitError, ValidationError } from '../../../shared/errors/index.js';
import { AUTH_RATE_LIMIT_POLICIES } from '../../../shared/auth/rate-limit-policies.js';
import { clampCursorLimit, decodeCursor, encodeCursor } from '../../../shared/pagination/index.js';
import { WebhookSubscriptionStatus } from '../domain/webhook-subscription-status.js';
import { toWebhookSubscriptionDto } from './webhook-subscription-dto.js';
import { requireWebhooksRead } from './webhook-permissions.js';

export class ListWebhookSubscriptions {
    deps;
    constructor(deps) {
        this.deps = deps;
    }
    async execute(input) {
        requireWebhooksRead(this.deps.authorization, input.actorPermissions);
        const rateLimit = await this.deps.rateLimiter.consume({
            policy: AUTH_RATE_LIMIT_POLICIES.webhookRead,
            subject: `${input.tenantId}:${input.actorId ?? input.tenantId}`,
        });
        if (!rateLimit.allowed) {
            throw new RateLimitError(rateLimit.retryAfterSeconds);
        }
        const limit = clampCursorLimit(input.limit);
        const fetchLimit = limit + 1;
        let cursorCreatedAt = null;
        let cursorId = null;
        if (input.cursor !== undefined) {
            const parts = decodeCursor(input.cursor);
            if (parts.length !== 2) {
                throw new ValidationError('Invalid cursor');
            }
            cursorCreatedAt = new Date(parts[0] ?? '');
            cursorId = parts[1] ?? null;
        }
        const statuses = input.status !== undefined
            ? [input.status]
            : input.includeDeleted === true
                ? undefined
                : [WebhookSubscriptionStatus.ACTIVE, WebhookSubscriptionStatus.DISABLED];
        const page = await this.deps.database.execute(async (tx) => this.deps.subscriptions.listPage(tx, input.tenantId, {
            ...(statuses === undefined ? {} : { statuses }),
        }, fetchLimit, cursorCreatedAt, cursorId), { tenantId: input.tenantId });
        const hasMore = page.length > limit;
        const items = hasMore ? page.slice(0, limit) : page;
        const last = items.at(-1);
        return {
            items: items.map((subscription) => toWebhookSubscriptionDto(subscription)),
            hasMore,
            nextCursor: hasMore && last !== undefined
                ? encodeCursor([last.createdAt.toISOString(), last.id])
                : null,
        };
    }
}
