export class DefaultAuditRecorder {
    repository;
    constructor(repository) {
        this.repository = repository;
    }
    async record(tx, event) {
        await this.repository.insert(tx, event);
    }
}
