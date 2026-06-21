import { z } from 'zod';
import { defineRoute } from '@/utils/define-route';
import { userService } from '@/services/user.service';
import {
  UpdateBaseCurrencySchema,
  UpdateProfileSchema,
} from '@/schemas/user.schema';

/**
 * Users — controllers (docs/ARCHITECTURE.md §8). Self-service profile settings;
 * the service only ever updates ctx.userId's own row (owner-scoped).
 */
export const readProfile = defineRoute({
  name: 'profile.read',
  // Self-only read: no RBAC permission needed beyond a valid session.
  rateLimit: 'settings.update',
  schema: z.object({}).strict(),
  handler: ({ ctx }) => userService.getProfile(ctx),
  audit: false,
});

export const updateProfile = defineRoute({
  name: 'profile.update',
  permission: 'settings.write',
  rateLimit: 'settings.update',
  schema: UpdateProfileSchema,
  handler: ({ ctx, input }) => userService.updateProfile(ctx, input),
  audit: ({ ctx }) => ({
    action: 'profile.update',
    resourceType: 'user',
    resourceId: ctx.userId,
    targetUserId: ctx.userId,
  }),
});

export const updateCurrency = defineRoute({
  name: 'settings.currency.update',
  permission: 'settings.write',
  rateLimit: 'settings.update',
  schema: UpdateBaseCurrencySchema,
  handler: ({ ctx, input }) => userService.updateBaseCurrency(ctx, input),
  audit: ({ input }) => ({
    action: 'settings.currency.update',
    resourceType: 'user',
    metadata: { currency: input.currency }, // not sensitive
  }),
});
