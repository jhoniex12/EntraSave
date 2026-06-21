import { randomUUID } from 'node:crypto';
import type { Request, RequestHandler, Response } from 'express';
import { z, ZodError, type ZodType } from 'zod';
import type { AuthContext } from '@/utils/auth-context';
import { requireAuth } from '@/utils/require-auth';
import { requirePermission } from '@/utils/require-permission';
import { enforceRateLimit, type RateLimitKey } from '@/utils/ratelimit';
import { recordAudit, type AuditEntry } from '@/services/audit.service';
import { clientIp } from '@/utils/request-context';
import { logger } from '@/utils/logger';
import {
  AppError,
  ValidationError,
  isAppError,
} from '@/utils/app-error';
import { ok, fail, type ActionResult } from '@/utils/result';

/**
 * defineRoute — the single, mandatory pipeline for every mutating/owned API
 * endpoint. It provides the application's mandatory protected request chain:
 *
 *   raw input (req.body)
 *     → requireAuth        (local JWT session → AuthContext)    §4
 *     → requirePermission  (DB-backed RBAC, deny-by-default)    §5
 *     → enforceRateLimit   (per-user, abuse prevention)         §13
 *     → schema.parse       (Zod; untrusted input becomes typed) §8
 *     → ownership hook      (per-resource owner check)          §5
 *     → handler            (service layer — business logic)     §10
 *     → recordAudit        (append-only security log)           §14
 *     → ActionResult<T>    (typed, safe; never leaks internals) §15
 *
 * Business logic NEVER lives here or in a controller — only in services. This
 * wrapper exists so the chain above cannot be forgotten or reordered.
 *
 * The handler also receives the raw `req`/`res` so the (few) auth endpoints can
 * set/clear the session cookie. They must NOT use them to re-read input or to
 * bypass any layer above.
 */
interface ActionConfigBase<S extends ZodType> {
  /** Audit/rate-limit/log name, e.g. "transaction.create". */
  name: string;
  schema: S;
}

interface HandlerEnv {
  req: Request;
  res: Response;
}

export interface ProtectedActionConfig<S extends ZodType, TOutput> extends ActionConfigBase<S> {
  authentication?: 'required';
  /** RBAC permission required (the "what you ARE" check). Optional for self-only reads. */
  permission?: string;
  /** Per-user rate limit policy key. */
  rateLimit?: RateLimitKey;
  /** Per-resource ownership/authorization hook (the "what is YOURS" check). */
  ownership?: (args: { ctx: AuthContext; input: z.output<S> }) => Promise<void> | void;
  /** The use-case. Receives ctx + validated input; calls the service layer. */
  handler: (args: { ctx: AuthContext; input: z.output<S> } & HandlerEnv) => Promise<TOutput>;
  /**
   * Audit entry to record on success. Default `true` writes a minimal entry.
   * Provide a builder for richer (already-redacted) metadata. `false` to skip
   * (e.g. high-volume reads).
   */
  audit?:
    | boolean
    | ((args: { ctx: AuthContext; input: z.output<S>; output: TOutput }) => AuditEntry);
}

/** Explicit exception for unauthenticated credential entrypoints. */
export interface PublicActionConfig<S extends ZodType, TOutput> extends ActionConfigBase<S> {
  authentication: 'public';
  rateLimit: RateLimitKey;
  handler: (args: { input: z.output<S> } & HandlerEnv) => Promise<TOutput>;
  audit: false;
}

export function defineRoute<S extends ZodType, TOutput>(
  config: ProtectedActionConfig<S, TOutput>,
): RequestHandler;
export function defineRoute<S extends ZodType, TOutput>(
  config: PublicActionConfig<S, TOutput>,
): RequestHandler;
export function defineRoute<S extends ZodType, TOutput>(
  config: ProtectedActionConfig<S, TOutput> | PublicActionConfig<S, TOutput>,
): RequestHandler {
  return async function handler(req: Request, res: Response): Promise<void> {
    const requestId = req.requestId ?? randomUUID();
    const raw: unknown = req.body ?? {};

    try {
      if (config.authentication === 'public') {
        await enforceRateLimit(config.rateLimit, clientIp(req) ?? 'unknown');
        const input = parseInput(config.schema, raw);
        send(res, ok(await config.handler({ input, req, res })));
        return;
      }

      // 1) Authentication
      const ctx = await requireAuth(req);
      ctx.requestId ??= requestId;

      // 2) Authorization (RBAC) — deny by default
      if (config.permission) {
        requirePermission(ctx, config.permission);
      }

      // 3) Rate limiting / abuse prevention
      if (config.rateLimit) {
        await enforceRateLimit(config.rateLimit, ctx.userId);
      }

      // 4) Input validation — untrusted input becomes typed here
      const input = parseInput(config.schema, raw);

      // 5) Ownership / per-resource authorization
      if (config.ownership) {
        await config.ownership({ ctx, input });
      }

      // 6) Business logic (service layer)
      const output = await config.handler({ ctx, input, req, res });

      // 7) Audit (mutations / sensitive actions)
      if (config.audit !== false) {
        const entry: AuditEntry =
          typeof config.audit === 'function'
            ? config.audit({ ctx, input, output })
            : { action: config.name };
        await recordAudit(ctx, entry);
      }

      send(res, ok(output));
    } catch (err) {
      send(res, mapError(err, config.name, requestId));
    }
  };
}

function send<T>(res: Response, result: ActionResult<T>): void {
  if (result.ok) {
    res.status(200).json(result);
    return;
  }
  const status = statusForCode(result.error.code);
  if (result.error.retryAfter !== undefined) {
    res.setHeader('Retry-After', String(result.error.retryAfter));
  }
  res.status(status).json(result);
}

/** Map the stable machine code back to an HTTP status for transport. */
function statusForCode(code: string): number {
  switch (code) {
    case 'UNAUTHENTICATED': return 401;
    case 'FORBIDDEN': return 403;
    case 'NOT_FOUND': return 404;
    case 'CONFLICT': return 409;
    case 'VALIDATION': return 422;
    case 'RATE_LIMITED': return 429;
    default: return 500;
  }
}

function parseInput<S extends ZodType>(schema: S, raw: unknown): z.output<S> {
  const parsed = schema.safeParse(raw);
  if (!parsed.success) {
    throw toValidationError(parsed.error);
  }
  return parsed.data;
}

function toValidationError(error: ZodError): ValidationError {
  const flat = error.flatten().fieldErrors;
  const fieldErrors: Record<string, string[]> = {};
  for (const [key, msgs] of Object.entries(flat)) {
    if (msgs && msgs.length > 0) fieldErrors[key] = msgs;
  }
  return new ValidationError(fieldErrors);
}

function mapError(err: unknown, name: string, requestId: string): ActionResult<never> {
  if (isAppError(err)) {
    // Expected, typed error — safe to surface to the client.
    if (err.status >= 500) {
      logger.error(`route.${name}.error`, { code: err.code, requestId });
    } else {
      logger.warn(`route.${name}.rejected`, { code: err.code, requestId });
    }
    return fail({
      code: err.code,
      message: err.message,
      fieldErrors: err.fieldErrors,
      retryAfter: err.retryAfter,
      requestId,
    });
  }

  // Unknown/unexpected — log full detail server-side, return a generic message.
  logger.error(`route.${name}.unhandled`, {
    requestId,
    error: err instanceof Error ? err.message : 'unknown',
    stack: err instanceof Error ? err.stack : undefined,
  });
  const internal = new AppError('INTERNAL', 'Something went wrong. Please try again.', 500);
  return fail({ code: internal.code, message: internal.message, requestId });
}
