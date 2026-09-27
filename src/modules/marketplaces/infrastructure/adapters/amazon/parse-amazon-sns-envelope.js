import { MarketplaceValidationError } from '../../../domain/marketplace-errors.js';

/**
 * Parses an SNS envelope posted to Nexora's marketplace webhook ingress.
 * Operators typically subscribe HTTPS to SNS or forward SQS payloads unchanged.
 *
 * @param {string} rawBody
 */
export function parseAmazonSnsEnvelope(rawBody) {
    let envelope;
    try {
        envelope = JSON.parse(rawBody);
    }
    catch {
        throw new MarketplaceValidationError('Amazon webhook body is not valid JSON');
    }
    if (envelope === null || typeof envelope !== 'object') {
        throw new MarketplaceValidationError('Amazon webhook body must be a JSON object');
    }
    const type = typeof envelope.Type === 'string' ? envelope.Type : '';
    if (type === 'SubscriptionConfirmation' || type === 'UnsubscribeConfirmation') {
        return { kind: 'subscription_handshake', envelope };
    }
    if (type !== 'Notification') {
        throw new MarketplaceValidationError('Amazon SNS message type is not supported', { type });
    }
    const messageRaw = envelope.Message;
    if (typeof messageRaw !== 'string' || messageRaw.trim().length === 0) {
        throw new MarketplaceValidationError('Amazon SNS notification is missing Message');
    }
    let message;
    try {
        message = JSON.parse(messageRaw);
    }
    catch {
        throw new MarketplaceValidationError('Amazon SNS Message is not valid JSON');
    }
    return {
        kind: 'notification',
        envelope,
        message,
        topicArn: typeof envelope.TopicArn === 'string' ? envelope.TopicArn : null,
        messageId: typeof envelope.MessageId === 'string' ? envelope.MessageId : null,
    };
}
