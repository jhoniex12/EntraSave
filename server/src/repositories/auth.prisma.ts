import type { Prisma } from '@prisma/client';
import { prisma } from '@/config/prisma';
import type {
  AuthAccountRecord,
  AuthRepository,
  LinkProviderResult,
  OAuthIdentityData,
  UnlinkProviderResult,
} from '@/repositories/auth.repository';
import type { OAuthProvider } from '@/schemas/auth.schema';

const accountSelect = {
  id: true,
  email: true,
  passwordHash: true,
  status: true,
  sessionVersion: true,
} as const;

class PrismaAuthRepository implements AuthRepository {
  async findByEmail(email: string): Promise<AuthAccountRecord | null> {
    return prisma.user.findUnique({ where: { email }, select: accountSelect });
  }

  async createPasswordUser(input: {
    email: string;
    passwordHash: string;
    displayName?: string;
  }): Promise<AuthAccountRecord | null> {
    try {
      return await prisma.$transaction(async (tx) => {
        const user = await tx.user.create({
          data: {
            email: input.email,
            passwordHash: input.passwordHash,
            displayName: input.displayName,
            status: 'ACTIVE',
          },
          select: accountSelect,
        });
        await attachDefaultRole(tx, user.id);
        return user;
      });
    } catch (error) {
      if (isUniqueConstraintError(error)) return null;
      throw error;
    }
  }

  async findOrCreateOAuthUser(input: OAuthIdentityData): Promise<AuthAccountRecord | null> {
    try {
      return await prisma.$transaction(async (tx) => {
        const providerMatch = await tx.user.findFirst({
          where: input.provider === 'google'
            ? { googleId: input.providerId }
            : { facebookId: input.providerId },
          select: accountSelect,
        });
        if (providerMatch) {
          return tx.user.update({
            where: { id: providerMatch.id },
            data: {
              ...(input.displayName ? { displayName: input.displayName } : {}),
              ...(input.avatarUrl ? { avatarUrl: input.avatarUrl } : {}),
            },
            select: accountSelect,
          });
        }

        const emailMatch = await tx.user.findUnique({
          where: { email: input.email },
          select: { ...accountSelect, googleId: true, facebookId: true, emailVerifiedAt: true },
        });
        if (emailMatch) {
          // A credential-less row is a legacy hosted-auth account produced by
          // the migration. A verified provider may safely claim it because no
          // password or other provider credential remains usable by an attacker.
          // Never do this for an unverified password/provider account: that
          // would allow account pre-claim while the attacker retained access.
          const hasExistingCredential = Boolean(
            emailMatch.passwordHash || emailMatch.googleId || emailMatch.facebookId,
          );
          if (!emailMatch.emailVerifiedAt && hasExistingCredential) return null;
          const currentProviderId = input.provider === 'google'
            ? emailMatch.googleId
            : emailMatch.facebookId;
          if (currentProviderId && currentProviderId !== input.providerId) return null;

          return tx.user.update({
            where: { id: emailMatch.id },
            data: input.provider === 'google'
              ? {
                  googleId: input.providerId,
                  emailVerifiedAt: new Date(),
                  ...(input.avatarUrl ? { avatarUrl: input.avatarUrl } : {}),
                }
              : {
                  facebookId: input.providerId,
                  emailVerifiedAt: new Date(),
                  ...(input.avatarUrl ? { avatarUrl: input.avatarUrl } : {}),
                },
            select: accountSelect,
          });
        }

        const user = await tx.user.create({
          data: {
            email: input.email,
            displayName: input.displayName,
            avatarUrl: input.avatarUrl,
            status: 'ACTIVE',
            emailVerifiedAt: new Date(),
            ...(input.provider === 'google'
              ? { googleId: input.providerId }
              : { facebookId: input.providerId }),
          },
          select: accountSelect,
        });
        await attachDefaultRole(tx, user.id);
        return user;
      });
    } catch (error) {
      if (isUniqueConstraintError(error)) {
        // A concurrent callback won the insert/link race; retry as a lookup.
        return prisma.user.findFirst({
          where: input.provider === 'google'
            ? { googleId: input.providerId }
            : { facebookId: input.providerId },
          select: accountSelect,
        });
      }
      throw error;
    }
  }

  async linkOAuthProvider(input: {
    userId: string;
    provider: OAuthProvider;
    providerId: string;
  }): Promise<LinkProviderResult> {
    const { userId, provider, providerId } = input;
    try {
      return await prisma.$transaction(async (tx) => {
        const user = await tx.user.findFirst({
          where: { id: userId, deletedAt: null },
          select: { googleId: true, facebookId: true },
        });
        if (!user) return 'not_found';

        const current = provider === 'google' ? user.googleId : user.facebookId;
        // Already attached to this exact identity → idempotent success. A
        // different identity for the same provider must be disconnected first.
        if (current) return current === providerId ? 'linked' : 'already_connected';

        const taken = await tx.user.findFirst({
          where: provider === 'google' ? { googleId: providerId } : { facebookId: providerId },
          select: { id: true },
        });
        if (taken && taken.id !== userId) return 'provider_taken';

        await tx.user.update({
          where: { id: userId },
          data: provider === 'google' ? { googleId: providerId } : { facebookId: providerId },
        });
        return 'linked';
      });
    } catch (error) {
      // Lost a race to another linker claiming the same provider identity.
      if (isUniqueConstraintError(error)) return 'provider_taken';
      throw error;
    }
  }

  async unlinkOAuthProvider(userId: string, provider: OAuthProvider): Promise<UnlinkProviderResult> {
    return prisma.$transaction(async (tx) => {
      const user = await tx.user.findFirst({
        where: { id: userId, deletedAt: null },
        select: { passwordHash: true, googleId: true, facebookId: true },
      });
      if (!user) return 'not_found';

      const current = provider === 'google' ? user.googleId : user.facebookId;
      if (!current) return 'not_connected';

      // Never strand an account with no way back in.
      const otherProvider = provider === 'google' ? user.facebookId : user.googleId;
      if (!user.passwordHash && !otherProvider) return 'last_method';

      await tx.user.update({
        where: { id: userId },
        data: provider === 'google' ? { googleId: null } : { facebookId: null },
      });
      return 'unlinked';
    });
  }

  async incrementSessionVersion(userId: string): Promise<void> {
    await prisma.user.updateMany({
      where: { id: userId, deletedAt: null },
      data: { sessionVersion: { increment: 1 } },
    });
  }
}

async function attachDefaultRole(
  tx: Prisma.TransactionClient,
  userId: string,
): Promise<void> {
  const role = await tx.role.findUnique({ where: { key: 'USER' }, select: { id: true } });
  if (!role) throw new Error('Default USER role is not seeded');
  await tx.userRole.create({ data: { userId, roleId: role.id } });
}

function isUniqueConstraintError(error: unknown): boolean {
  return typeof error === 'object' && error !== null && 'code' in error && error.code === 'P2002';
}

export const authRepository: AuthRepository = new PrismaAuthRepository();
