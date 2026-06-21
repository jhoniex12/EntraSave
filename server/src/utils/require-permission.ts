import type { AuthContext } from '@/utils/auth-context';
import { ForbiddenError } from '@/utils/app-error';

/**
 * Server-side permission gate (ARCHITECTURE.md §5). Deny-by-default: if the
 * caller's resolved permission set does not include `permission`, throw 403.
 *
 * This is the "what you ARE" check. The separate "what is YOURS" (ownership)
 * check is enforced per-resource via the action wrapper's `ownership` hook and,
 * ultimately, by repositories scoping every query to ctx.userId.
 */
export function requirePermission(ctx: AuthContext, permission: string): void {
  if (!ctx.permissions.has(permission)) {
    throw new ForbiddenError();
  }
}
