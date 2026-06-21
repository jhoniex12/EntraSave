import { prisma } from '@/config/prisma';
import type { BalanceRepository } from '@/repositories/balance.repository';

/**
 * Monthly balance — Prisma adapter (ARCHITECTURE.md §1, §11). The ONLY place
 * Prisma is touched for monthly balance overrides. Scoped to `userId`.
 */
class PrismaBalanceRepository implements BalanceRepository {
  async getForMonth(userId: string, year: number, month: number): Promise<string | null> {
    const row = await prisma.monthlyBalance.findUnique({
      where: { userId_year_month: { userId, year, month } },
      select: { startingBalance: true },
    });
    return row?.startingBalance.toString() ?? null;
  }

  async upsertForMonth(
    userId: string,
    year: number,
    month: number,
    startingBalance: string,
  ): Promise<void> {
    await prisma.monthlyBalance.upsert({
      where: { userId_year_month: { userId, year, month } },
      create: { userId, year, month, startingBalance },
      update: { startingBalance },
    });
  }

  async removeForMonth(userId: string, year: number, month: number): Promise<void> {
    await prisma.monthlyBalance.deleteMany({ where: { userId, year, month } });
  }
}

export const balanceRepository: BalanceRepository = new PrismaBalanceRepository();
