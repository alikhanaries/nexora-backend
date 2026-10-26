/**
 * One-time helper: copy NOON_* vars from env.noon.local.example → .env.noon.local
 * Run BEFORE scrubbing the example file. Does not print secret values.
 */
import fs from 'node:fs';

function parseEnvText(text) {
  const out = {};
  for (const line of text.split(/\r?\n/)) {
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

const examplePath = 'env.noon.local.example';
if (!fs.existsSync(examplePath)) {
  console.error(JSON.stringify({ error: 'example file missing' }));
  process.exit(1);
}

const src = parseEnvText(fs.readFileSync(examplePath, 'utf8'));
const keys = [
  'WASL_NOON_CHANNEL_ID',
  'NOON_KEY_ID',
  'NOON_PROJECT_CODE',
  'NOON_PRIVATE_KEY_PEM',
  'NOON_COUNTRY_CODE',
  'NOON_WAREHOUSE_CODE',
];

const lines = [
  '# Local Noon connection — gitignored. Never commit.',
  '# Rotate service-account key if it was ever stored in env.noon.local.example or chat.',
  '',
];

for (const k of keys) {
  if (src[k]?.trim()) {
    lines.push(`${k}=${src[k]}`);
  } else if (k === 'NOON_COUNTRY_CODE' || k === 'NOON_WAREHOUSE_CODE') {
    lines.push(`# ${k}=`);
  }
}

lines.push('', '# Use WASL_ADMIN_PASSWORD from .env.stockconnect.local when running bootstrap.');
fs.writeFileSync('.env.noon.local', `${lines.join('\n')}\n`, 'utf8');

console.log(JSON.stringify({
  migrated: true,
  fieldsWritten: keys.filter((k) => Boolean(src[k]?.trim())),
}, null, 2));
