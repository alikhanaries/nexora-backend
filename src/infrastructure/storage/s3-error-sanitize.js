/**
 * Safe fields from AWS SDK S3 errors (no credentials or raw headers).
 *
 * @param {unknown} error
 */
export function sanitizeS3Error(error) {
    if (typeof error !== 'object' || error === null) {
        return { message: String(error) };
    }
    /** @type {Record<string, unknown>} */
    const err = error;
    /** @type {Record<string, unknown>} */
    const out = {};
    if (typeof err.name === 'string') {
        out.errorName = err.name;
    }
    const code = err.Code ?? err.code;
    if (typeof code === 'string') {
        out.errorCode = code;
    }
    const meta = err.$metadata;
    if (typeof meta === 'object' && meta !== null) {
        /** @type {Record<string, unknown>} */
        const m = meta;
        if (typeof m.httpStatusCode === 'number') {
            out.httpStatus = m.httpStatusCode;
        }
        if (typeof m.requestId === 'string') {
            out.requestId = m.requestId;
        }
    }
    if (typeof err.message === 'string') {
        out.message = err.message.slice(0, 240);
    }
    return out;
}

/**
 * @param {unknown} error
 */
export function isS3BucketAlreadyExistsError(error) {
    if (typeof error !== 'object' || error === null) {
        return false;
    }
    /** @type {Record<string, unknown>} */
    const err = error;
    const name = typeof err.name === 'string' ? err.name : '';
    const code = typeof err.Code === 'string'
        ? err.Code
        : typeof err.code === 'string'
            ? err.code
            : '';
    return name === 'BucketAlreadyOwnedByYou'
        || name === 'BucketAlreadyExists'
        || code === 'BucketAlreadyOwnedByYou'
        || code === 'BucketAlreadyExists';
}
