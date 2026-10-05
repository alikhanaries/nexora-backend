/**
 * Loads reflect-metadata and SWC ESM transforms so Nest decorator syntax in `src/nest/*.js`
 * runs under Node without a compile step. Used by `npm start`, `npm run dev`, and parity with tests.
 */
import 'reflect-metadata';
import { register } from 'node:module';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

process.env.SWCRC ??= '1';
const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '../..');
register('@swc-node/register/esm', pathToFileURL(join(repoRoot, '/')).href);
