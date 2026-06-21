/**
 * Typed application errors (docs/ARCHITECTURE.md §15).
 *
 * Services and the route wrapper throw these; the wrapper maps them to safe,
 * client-facing results. Raw exceptions / stack traces are NEVER returned to
 * the client. Each error carries a stable machine `code` and an HTTP `status`.
 */
export type AppErrorCode =
  | 'UNAUTHENTICATED'
  | 'FORBIDDEN'
  | 'VALIDATION'
  | 'NOT_FOUND'
  | 'RATE_LIMITED'
  | 'CONFLICT'
  | 'INTERNAL';

export class AppError extends Error {
  readonly code: AppErrorCode;
  readonly status: number;
  /** Field-level validation errors, safe to show the user. */
  readonly fieldErrors?: Record<string, string[]>;
  /** Seconds the client should wait before retrying (429). */
  readonly retryAfter?: number;

  constructor(
    code: AppErrorCode,
    message: string,
    status: number,
    opts?: { fieldErrors?: Record<string, string[]>; retryAfter?: number },
  ) {
    super(message);
    this.name = new.target.name;
    this.code = code;
    this.status = status;
    this.fieldErrors = opts?.fieldErrors;
    this.retryAfter = opts?.retryAfter;
  }
}

export class AuthError extends AppError {
  constructor(message = 'Not authenticated') {
    super('UNAUTHENTICATED', message, 401);
  }
}

export class ForbiddenError extends AppError {
  constructor(message = 'You do not have permission to do that') {
    super('FORBIDDEN', message, 403);
  }
}

export class ValidationError extends AppError {
  constructor(fieldErrors: Record<string, string[]>, message = 'Invalid input') {
    super('VALIDATION', message, 422, { fieldErrors });
  }
}

export class NotFoundError extends AppError {
  constructor(message = 'Not found') {
    super('NOT_FOUND', message, 404);
  }
}

export class RateLimitError extends AppError {
  constructor(retryAfter: number, message = 'Too many requests') {
    super('RATE_LIMITED', message, 429, { retryAfter });
  }
}

export class ConflictError extends AppError {
  constructor(message = 'Conflict') {
    super('CONFLICT', message, 409);
  }
}

export function isAppError(err: unknown): err is AppError {
  return err instanceof AppError;
}
