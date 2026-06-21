import { z } from 'zod';

/**
 * Boot-time environment validation (docs/ARCHITECTURE.md §16).
 *
 * The API REFUSES TO START if the environment is invalid. Never read
 * `process.env` directly anywhere else — import the typed `env` from here so
 * there is a single, validated source of truth.
 *
 * Server secrets never enter the client bundle; the React application talks to
 * this API only through the documented HTTP boundary.
 */
const EnvSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  /** Port the Express API listens on. */
  PORT: z.coerce.number().int().min(1).max(65_535).default(4000),
  /** Public base URL of THIS API (used to derive OAuth callback URLs). */
  APP_URL: z.string().url(),
  /** Origin of the React client (CORS allowlist + post-OAuth redirect target). */
  CLIENT_URL: z.string().url(),

  // Persistence — SQL Server today (sqlserver://...), PostgreSQL later (postgres://...).
  DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),

  // Self-managed sessions. Use at least 32 random bytes and rotate deliberately;
  // changing this value invalidates every active session and OAuth flow.
  JWT_SECRET: z.string().min(32),
  JWT_ISSUER: z.string().min(1).default('entrasave'),
  JWT_AUDIENCE: z.string().min(1).default('entrasave-web'),
  SESSION_TTL_SECONDS: z.coerce.number().int().min(300).max(86_400).default(28_800),

  // Direct OAuth credentials. A provider is enabled only when both values exist.
  GOOGLE_CLIENT_ID: z.string().min(1).optional(),
  GOOGLE_CLIENT_SECRET: z.string().min(1).optional(),
  FACEBOOK_APP_ID: z.string().min(1).optional(),
  FACEBOOK_APP_SECRET: z.string().min(1).optional(),
  FACEBOOK_GRAPH_VERSION: z.string().regex(/^v\d+\.\d+$/).optional(),

  LOG_LEVEL: z.enum(['error', 'warn', 'info', 'debug']).default('info'),

  // ── Future / optional (abstractions exist; backends added later) ──
  REDIS_URL: z.string().url().optional(),
  STORAGE_DRIVER: z.enum(['local', 's3', 'r2']).default('local'),
  S3_ENDPOINT: z.string().url().optional(),
  S3_BUCKET: z.string().optional(),
  S3_ACCESS_KEY_ID: z.string().optional(),
  S3_SECRET_ACCESS_KEY: z.string().optional(),
  TURNSTILE_SECRET: z.string().optional(),
}).superRefine((val, ctx) => {
  for (const [left, right] of [
    ['GOOGLE_CLIENT_ID', 'GOOGLE_CLIENT_SECRET'],
    ['FACEBOOK_APP_ID', 'FACEBOOK_APP_SECRET'],
  ] as const) {
    if (Boolean(val[left]) !== Boolean(val[right])) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: [right],
        message: `${left} and ${right} must be configured together`,
      });
    }
  }
  if (val.FACEBOOK_APP_ID && !val.FACEBOOK_GRAPH_VERSION) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['FACEBOOK_GRAPH_VERSION'],
      message: 'FACEBOOK_GRAPH_VERSION is required when Facebook login is enabled',
    });
  }
});

export type Env = z.infer<typeof EnvSchema>;

function loadEnv(): Env {
  // Treat blank assignments (e.g. `GOOGLE_CLIENT_ID=` in .env) as "not set" so
  // optional providers stay disabled instead of failing `.min(1)`. A provider is
  // enabled only when its values actually exist.
  const source = Object.fromEntries(
    Object.entries(process.env).filter(([, value]) => value !== ''),
  );
  const parsed = EnvSchema.safeParse(source);
  if (!parsed.success) {
    // Print field names only — NEVER print values (they may be secrets).
    const issues = parsed.error.issues
      .map((i) => `  - ${i.path.join('.') || '(root)'}: ${i.message}`)
      .join('\n');
    throw new Error(`Invalid environment configuration:\n${issues}`);
  }
  return parsed.data;
}

export const env = loadEnv();

export const isProd = env.NODE_ENV === 'production';
export const isDev = env.NODE_ENV === 'development';
