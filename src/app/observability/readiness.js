export class ReadinessService {
    probes;
    acceptingTraffic = true;
    constructor(probes) {
        this.probes = probes;
    }
    markNotReady() {
        this.acceptingTraffic = false;
    }
    isAcceptingTraffic() {
        return this.acceptingTraffic;
    }
    async evaluate() {
        if (!this.acceptingTraffic) {
            return { ready: false, checks: { process: 'failed' } };
        }
        const checks = {};
        let ready = true;
        for (const probe of this.probes) {
            try {
                await probe.check();
                checks[probe.name] = 'ok';
            }
            catch {
                checks[probe.name] = 'failed';
                ready = false;
            }
        }
        return { ready, checks };
    }
}
export function createDefaultProbes(deps) {
    return [
        { name: 'postgres', check: () => deps.database.healthCheck() },
        { name: 'redis', check: () => deps.redis.healthCheck() },
        { name: 'queue', check: () => deps.queue.healthCheck() },
        { name: 'storage', check: () => deps.storage.healthCheck() },
    ];
}
export function createWorkerReadinessProbes(deps) {
    return [
        { name: 'postgres', check: () => deps.database.healthCheck() },
        { name: 'redis', check: () => deps.redis.healthCheck() },
        { name: 'queue', check: () => deps.queue.healthCheck() },
        {
            name: 'workers_registered',
            check: async () => {
                if (!deps.workerRuntime.hasRegisteredWorkers()) {
                    throw new Error('no workers registered');
                }
            },
        },
    ];
}
