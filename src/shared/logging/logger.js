/** No-op logger for unit tests and code paths that must never emit output. */
export const silentLogger = {
    trace: () => undefined,
    debug: () => undefined,
    info: () => undefined,
    warn: () => undefined,
    error: () => undefined,
    fatal: () => undefined,
    child: () => silentLogger,
    flush: () => Promise.resolve(),
};
