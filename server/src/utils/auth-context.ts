
/**
 * The authenticated request context (ARCHITECTURE.md §4, §5).
 *
 * Built ONCE per request at the action/route boundary and threaded explicitly
 * into services. Services never re-read the request — they receive `ctx`. The
 * The internal `userId` from the verified JWT is what every owned query uses.
 */
export interface AuthContext {
  /** Internal User.id — the ownership key for all user-owned data. */
  userId: string;
  email: string;
  /** DB-backed counter used to revoke all previously issued JWTs. */
  sessionVersion: number;
  /** The user's preferred display currency (ISO 4217), e.g. "USD". */
  baseCurrency: string;
  /** Role keys, e.g. ["USER"]. */
  roles: string[];
  /** Flattened permission keys resolved from roles, e.g. {"transactions.write"}. */
  permissions: Set<string>;
  /** Best-effort client IP (from trusted forwarded header at the edge). */
  ip?: string;
  /** Correlation id propagated from middleware for log/audit stitching. */
  requestId?: string;
}

export function hasPermission(ctx: AuthContext, permission: string): boolean {
  return ctx.permissions.has(permission);
}

export function hasRole(ctx: AuthContext, role: string): boolean {
  return ctx.roles.includes(role);
}
