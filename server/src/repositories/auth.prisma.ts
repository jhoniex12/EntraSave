import type { Prisma } from '@prisma/client';
import { prisma } from '@/config/prisma';
import type {
  AuthAccountRecord,
  AuthRepository,
  OAuthIdentityData,
} from '@/repositories/auth.repository';

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
