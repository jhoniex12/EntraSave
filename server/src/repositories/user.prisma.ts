import { prisma } from '@/config/prisma';
import type { UserRepository } from '@/repositories/user.repository';

class PrismaUserRepository implements UserRepository {
  async getProfile(userId: string) {
    return prisma.user.findFirst({
      where: { id: userId, deletedAt: null },
      select: {
        displayName: true,
        email: true,
        avatarUrl: true,
        passwordHash: true,
        googleId: true,
        facebookId: true,
      },
    });
  }

  async updateDisplayName(userId: string, displayName: string): Promise<number> {
    const result = await prisma.user.updateMany({
      where: { id: userId, deletedAt: null },
      data: { displayName },
    });
    return result.count;
  }

  async updateBaseCurrency(userId: string, currency: string): Promise<void> {
    await prisma.user.update({
      where: { id: userId },
      data: { baseCurrency: currency },
    });
  }
}

export const userRepository: UserRepository = new PrismaUserRepository();
