import { prisma } from '@/config/prisma';
import { logger } from '@/utils/logger';
import type { AuthContext } from '@/utils/auth-context';

/**
 * Audit logging (ARCHITECTURE.md §14). The append-only security record of
 * truth. Written for every mutation and every admin action. `metadata` must
 * already be REDACTED by the caller — never store raw money/PII here (store
 * ids and outcomes, e.g. { transactionId } not { amount }).
 *
 * Audit writes must never break the user-facing operation: failures are logged
 * but swallowed.
 */
export interface AuditEntry {
  action: string;
  targetUserId?: string | null;
  resourceType?: string;
  resourceId?: string;
  metadata?: Record<string, unknown>;
}

export async function recordAudit(ctx: AuthContext, entry: AuditEntry): Promise<void> {
  try {
    await prisma.auditLog.create({
      data: {
        actorUserId: ctx.userId,
        targetUserId: entry.targetUserId ?? null,
        action: entry.action,
        resourceType: entry.resourceType,
        resourceId: entry.resourceId,
        metadata: entry.metadata ? JSON.stringify(entry.metadata) : null,
        ip: ctx.ip,
        requestId: ctx.requestId,
      },
    });
  } catch (err) {
    logger.error('audit.write_failed', {
      action: entry.action,
      requestId: ctx.requestId,
      error: err instanceof Error ? err.message : 'unknown',
    });
  }
}
