import { findUndeliverableEventTypes } from '../../../shared/events/index.js';
import { ValidationError } from '../../../shared/errors/index.js';

export function validateWebhookEventTypes(eventTypes) {
    if (!Array.isArray(eventTypes) || eventTypes.length === 0) {
        throw new ValidationError('At least one event type is required');
    }
    const invalid = findUndeliverableEventTypes(eventTypes);
    if (invalid.length > 0) {
        throw new ValidationError('One or more event types are not externally deliverable', {
            invalidEventTypes: invalid,
        });
    }
    return [...new Set(eventTypes)];
}
