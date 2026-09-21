export type { LogFields, Logger } from './logger.js';
export { silentLogger } from './logger.js';
export {
  isPiiKey,
  isSensitiveKey,
  maskEmail,
  maskTail,
  PINO_REDACT_PATHS,
  REDACTED,
  redactDeep,
  redactUrl,
} from './redaction.js';
