process.env.SWCRC = '1';

import { register } from 'node:module';
import { pathToFileURL } from 'node:url';

register('@swc-node/register/esm', pathToFileURL('./').toString());

await import('./main.js');
