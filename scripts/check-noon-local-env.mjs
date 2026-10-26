import fs from 'node:fs';
import path from 'node:path';

function loadEnvFile(file) {
  if (!fs.existsSync(file)) return {};
  const out = {};
  for (const line of fs.readFileSync(file, 'utf8').split(/\r?\n/)) {
    const t = line.trim();
    if (!t || t.startsWith('#')) continue;
    const eq = t.indexOf('=');
    if (eq <= 0) continue;
    const k = t.slice(0, eq).trim();
    let v = t.slice(eq + 1).trim();
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
      v = v.slice(1, -1);
    }
    out[k] = v;
  }
  return out;
}

const root = process.cwd();
const envOnly = loadEnvFile(path.join(root, '.env'));
const noonOnly = loadEnvFile(path.join(root, '.env.noon.local'));
const scOnly = loadEnvFile(path.join(root, '.env.stockconnect.local'));
const merged = { ...envOnly, ...scOnly, ...noonOnly };

const REQUIRED = [
  'WASL_NOON_CHANNEL_ID',
  'NOON_KEY_ID',
  'NOON_PROJECT_CODE',
  'NOON_PRIVATE_KEY_PEM',
  'NOON_COUNTRY_CODE',
  'NOON_WAREHOUSE_CODE',
  'WASL_ADMIN_PASSWORD',
];

const CHANNEL_EXPECTED = 'c068bc73-e586-4512-94b9-e95f1121f0d5';
const COUNTRIES = new Set(['ae', 'sa', 'eg']);

function pemMeta(raw) {
  if (!raw?.trim()) return { present: false };
  const pem = raw.trim().replace(/\\n/g, '\n');
  return {
    present: true,
    length: pem.length,
    hasBegin: /-----BEGIN [A-Z ]+-----/.test(pem),
    hasEnd: /-----END [A-Z ]+-----/.test(pem),
    lineCount: pem.split('\n').length,
    escapedNewlinesInSource: raw.includes('\\n'),
  };
}

function sourceHint(key) {
  if (noonOnly[key] !== undefined) return '.env.noon.local';
  if (envOnly[key] !== undefined) return '.env';
  if (scOnly[key] !== undefined) return '.env.stockconnect.local';
  return 'missing';
}

const varPresence = Object.fromEntries(REQUIRED.map((k) => [k, Boolean(merged[k]?.trim())]));
const missing = REQUIRED.filter((k) => !varPresence[k]);

const report = {
  files: {
    dotEnv: fs.existsSync('.env'),
    dotEnvNoonLocal: fs.existsSync('.env.noon.local'),
    dotEnvStockconnectLocal: fs.existsSync('.env.stockconnect.local'),
  },
  varPresence,
  varSourceHint: Object.fromEntries(REQUIRED.map((k) => [k, sourceHint(k)])),
  channelIdMatchesExpected: merged.WASL_NOON_CHANNEL_ID?.trim() === CHANNEL_EXPECTED,
  countryCode: merged.NOON_COUNTRY_CODE?.trim().toLowerCase() || null,
  countryCodeValid: COUNTRIES.has((merged.NOON_COUNTRY_CODE || '').trim().toLowerCase()),
  projectCodeSet: varPresence.NOON_PROJECT_CODE,
  keyIdSet: varPresence.NOON_KEY_ID,
  warehouseCodeSet: varPresence.NOON_WAREHOUSE_CODE,
  privateKeyPem: pemMeta(merged.NOON_PRIVATE_KEY_PEM),
  adminPasswordSet: varPresence.WASL_ADMIN_PASSWORD,
  missing,
  readyForBootstrap:
    missing.length === 0
    && merged.WASL_NOON_CHANNEL_ID?.trim() === CHANNEL_EXPECTED
    && COUNTRIES.has((merged.NOON_COUNTRY_CODE || '').trim().toLowerCase())
    && pemMeta(merged.NOON_PRIVATE_KEY_PEM).present
    && pemMeta(merged.NOON_PRIVATE_KEY_PEM).hasBegin
    && pemMeta(merged.NOON_PRIVATE_KEY_PEM).hasEnd,
  readyForNoonLive: false,
  notes: [
    'readyForNoonLive requires bootstrap + authorized connection test against Noon (not run here).',
    'Rotate any key that was ever pasted into chat before production use.',
  ],
};

if (sourceHint('NOON_PRIVATE_KEY_PEM') === '.env') {
  report.notes.push('Consider moving Noon secrets to .env.noon.local only.');
}

console.log(JSON.stringify(report, null, 2));
