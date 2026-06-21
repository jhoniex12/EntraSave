import { env } from '@/config/env';

/**
 * Structured logger with redaction (ARCHITECTURE.md §14).
 *
 * Operational logs must NEVER contain financial values or PII. We log THAT a
 * transaction happened, never its amount. Keys matching the redaction list are
 * masked recursively before output. This is a minimal console implementation;
 * swap the `sink` for a centralized log shipper later without changing callers.
 */
const LEVELS = { error: 0, warn: 1, info: 2, debug: 3 } as const;
type Level = keyof typeof LEVELS;

const REDACT_KEYS = new Set([
  'amount',
  'balance',
  'targetamount',
  'currentamount',
  'email',
  'password',
  'token',
  'secret',
  'authorization',
  'cookie',
  'accountnumber',
  'notes',
  'description',
]);

function redact(value: unknown, depth = 0): unknown {
  if (depth > 6 || value == null) return value;
  if (Array.isArray(value)) return value.map((v) => redact(v, depth + 1));
  if (typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      out[k] = REDACT_KEYS.has(k.toLowerCase()) ? '[redacted]' : redact(v, depth + 1);
    }
    return out;
  }
  return value;
}

function log(level: Level, message: string, context?: Record<string, unknown>) {
  if (LEVELS[level] > LEVELS[env.LOG_LEVEL]) return;
  const entry = {
    ts: new Date().toISOString(),
    level,
    message,
    ...(context ? { context: redact(context) } : {}),
  };
  // Single-line JSON for ingestion by a log shipper.
  const line = JSON.stringify(entry);
  if (level === 'error') console.error(line);
  else if (level === 'warn') console.warn(line);
  else console.log(line);
}

export const logger = {
  error: (msg: string, ctx?: Record<string, unknown>) => log('error', msg, ctx),
  warn: (msg: string, ctx?: Record<string, unknown>) => log('warn', msg, ctx),
  info: (msg: string, ctx?: Record<string, unknown>) => log('info', msg, ctx),
  debug: (msg: string, ctx?: Record<string, unknown>) => log('debug', msg, ctx),
};
