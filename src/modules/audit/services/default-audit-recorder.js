/**
 * Append-only audit recorder used inside business transactions.
 * @param {{ insert: Function }} repository
 * @returns {{ record: Function }}
 */
export function createDefaultAuditRecorder(repository) {
    /**
     * @param {object} tx
     * @param {object} event
     */
    async function record(tx, event) {
        await repository.insert(tx, event);
    }

    return { record };
}
