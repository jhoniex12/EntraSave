import { z } from 'zod';
import { defineRoute } from '@/utils/define-route';
import { vaultService } from '@/services/vault.service';
import {
  CreateVaultItemSchema,
  DeleteVaultItemSchema,
  RekeyVaultSchema,
  ResetVaultSchema,
  SetupVaultSchema,
  UnlockVaultSchema,
  UpdateVaultItemSchema,
} from '@/schemas/vault.schema';

/**
 * Password vault — controllers (docs/ARCHITECTURE.md §8). Every query is
 * owner-scoped in the repository. Audit entries record ids and outcomes only;
 * ciphertext, IVs, PIN proofs, and key material never enter audit metadata.
 */
export const readVaultState = defineRoute({
  name: 'vault.state',
  permission: 'vault.read',
  rateLimit: 'vault.read',
  schema: z.object({}).strict(),
  handler: ({ ctx }) => vaultService.getState(ctx),
  audit: false,
});

export const setupVault = defineRoute({
  name: 'vault.setup',
  permission: 'vault.write',
  rateLimit: 'vault.key',
  schema: SetupVaultSchema,
  handler: ({ ctx, input }) => vaultService.setup(ctx, input),
  audit: ({ ctx }) => ({ action: 'vault.setup', resourceType: 'vault', resourceId: ctx.userId }),
});

export const unlockVault = defineRoute({
  name: 'vault.unlock',
  permission: 'vault.read',
  // Per-user request cap on top of the service's wrong-PIN lockout.
  rateLimit: 'vault.unlock',
  schema: UnlockVaultSchema,
  handler: ({ ctx, input }) => vaultService.unlock(ctx, input.pinProof),
  audit: ({ ctx }) => ({ action: 'vault.unlock', resourceType: 'vault', resourceId: ctx.userId }),
});

export const listVaultItems = defineRoute({
  name: 'vault.list',
  permission: 'vault.read',
  rateLimit: 'vault.read',
  schema: z.object({}).strict(),
  handler: ({ ctx }) => vaultService.listItems(ctx),
  audit: false,
});

export const createVaultItem = defineRoute({
  name: 'vault.item.create',
  permission: 'vault.write',
  rateLimit: 'vault.write',
  schema: CreateVaultItemSchema,
  handler: ({ ctx, input }) => vaultService.createItem(ctx, input),
  audit: ({ output }) => ({ action: 'vault.item.create', resourceType: 'vault_item', resourceId: output.id }),
});

export const updateVaultItem = defineRoute({
  name: 'vault.item.update',
  permission: 'vault.write',
  rateLimit: 'vault.write',
  schema: UpdateVaultItemSchema,
  // Ownership is enforced by the owner-scoped update predicate.
  handler: ({ ctx, input }) => vaultService.updateItem(ctx, input),
  audit: ({ input }) => ({ action: 'vault.item.update', resourceType: 'vault_item', resourceId: input.id }),
});

export const deleteVaultItem = defineRoute({
  name: 'vault.item.delete',
  permission: 'vault.write',
  rateLimit: 'vault.write',
  schema: DeleteVaultItemSchema,
  handler: ({ ctx, input }) => vaultService.deleteItem(ctx, input.id),
  audit: ({ input }) => ({ action: 'vault.item.delete', resourceType: 'vault_item', resourceId: input.id }),
});

export const rekeyVault = defineRoute({
  name: 'vault.rekey',
  permission: 'vault.write',
  rateLimit: 'vault.key',
  schema: RekeyVaultSchema,
  handler: ({ ctx, input }) => vaultService.rekey(ctx, input),
  audit: ({ ctx, input }) => ({
    action: 'vault.rekey',
    resourceType: 'vault',
    resourceId: ctx.userId,
    metadata: { itemCount: input.items.length },
  }),
});

export const resetVault = defineRoute({
  name: 'vault.reset',
  permission: 'vault.write',
  rateLimit: 'vault.key',
  schema: ResetVaultSchema,
  handler: ({ ctx }) => vaultService.reset(ctx),
  audit: ({ ctx }) => ({ action: 'vault.reset', resourceType: 'vault', resourceId: ctx.userId }),
});
