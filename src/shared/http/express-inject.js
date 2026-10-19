import http from 'node:http';
import { URL } from 'node:url';

/**
 * In-process HTTP request against an Express (or Connect) app without Supertest.
 *
 * @param {import('http').RequestListener} app
 * @param {{ method?: string, url: string, headers?: Record<string, string | undefined>, payload?: unknown }} options
 */
export async function injectExpress(app, options) {
    const method = (options.method ?? 'GET').toUpperCase();
    const server = http.createServer(app);

    return new Promise((resolve, reject) => {
        server.listen(0, '127.0.0.1', () => {
            const address = server.address();
            if (address === null || typeof address === 'string') {
                server.close();
                reject(new Error('Failed to bind ephemeral port for inject'));
                return;
            }

            const baseUrl = `http://127.0.0.1:${address.port}`;
            const target = new URL(options.url, baseUrl);
            const body =
                options.payload === undefined
                    ? undefined
                    : typeof options.payload === 'string'
                      ? options.payload
                      : JSON.stringify(options.payload);

            const headers = { ...(options.headers ?? {}) };
            if (body !== undefined && headers['Content-Type'] === undefined && headers['content-type'] === undefined) {
                headers['Content-Type'] = 'application/json';
            }
            if (body !== undefined) {
                headers['Content-Length'] = String(Buffer.byteLength(body, 'utf8'));
            }

            const req = http.request(
                {
                    hostname: target.hostname,
                    port: target.port,
                    path: `${target.pathname}${target.search}`,
                    method,
                    headers,
                },
                (res) => {
                    const chunks = [];
                    res.on('data', (chunk) => chunks.push(chunk));
                    res.on('end', () => {
                        server.close();
                        const rawPayload = Buffer.concat(chunks);
                        const text = rawPayload.toString('utf8');
                        resolve({
                            statusCode: res.statusCode ?? 0,
                            headers: res.headers,
                            body: text,
                            rawPayload,
                            json() {
                                if (text.length === 0) {
                                    return null;
                                }
                                return JSON.parse(text);
                            },
                        });
                    });
                },
            );

            req.on('error', (error) => {
                server.close();
                reject(error);
            });

            if (body !== undefined) {
                req.write(body);
            }
            req.end();
        });
    });
}
