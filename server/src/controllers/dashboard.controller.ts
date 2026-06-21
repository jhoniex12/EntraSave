import { z } from 'zod';
import { defineRoute } from '@/utils/define-route';
import { dashboardService } from '@/services/dashboard.service';

/**
 * Dashboard — controller (docs/ARCHITECTURE.md §8, §10). Read-only summary,
 * owner-scoped via ctx.userId.
 */
export const dashboardSummary = defineRoute({
  name: 'dashboard.summary',
  permission: 'transactions.read',
  rateLimit: 'transaction.list',
  schema: z.object({}).strict(),
  handler: ({ ctx }) => dashboardService.getSummary(ctx),
  audit: false,
});
