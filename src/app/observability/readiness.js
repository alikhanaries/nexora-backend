/**
 * Kubernetes-style readiness: optional dependency probes plus a process-level traffic gate.
 */
export class ReadinessService {
    probes;
    acceptingTraffic = true;
    /** @param {Array<{ name: string, check: () => Promise<void> }>} probes */
    constructor(probes) {
        this.probes = probes;
    }
    /**
     * @param {{ name: string, check: () => Promise<void> }} probe
     */
    registerProbe(probe) {
        this.probes.push(probe);
    }
    /** Stops accepting traffic (e.g. during shutdown) without failing individual dependency probes. */
    markNotReady() {
        this.acceptingTraffic = false;
    }
    /** Process-level gate checked before running dependency probes. */
    isAcceptingTraffic() {
        return this.acceptingTraffic;
    }
    /** Runs all probes; returns aggregate ready flag and per-check status map. */
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
/** Standard API probes (postgres, redis, queue, storage). */
export function createDefaultProbes(deps) {
    return [
        { name: 'postgres', check: () => deps.database.healthCheck() },
        { name: 'redis', check: () => deps.redis.healthCheck() },
        { name: 'queue', check: () => deps.queue.healthCheck() },
        { name: 'storage', check: () => deps.storage.healthCheck() },
    ];
}
/** Worker process probes including registered BullMQ consumers. */
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
