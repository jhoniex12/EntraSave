import { Prisma, type Budget } from '@prisma/client';
import { prisma } from '@/config/prisma';
import type { BudgetRepository, BudgetSpendingRow } from '@/repositories/budget.repository';

class PrismaBudgetRepository implements BudgetRepository {
  async listForUser(userId: string): Promise<Budget[]> {
    return prisma.budget.findMany({
      where: { userId, period: 'MONTHLY', deletedAt: null },
      orderBy: { name: 'asc' },
    });
  }

  async listWithSpending(userId: string, from: Date, to: Date): Promise<BudgetSpendingRow[]> {
    const budgets = await this.listForUser(userId);
    if (budgets.length === 0) return [];
    const spending = await prisma.transaction.groupBy({
      by: ['categoryId'],
      _sum: { amount: true },
      where: {
        userId,
        deletedAt: null,
        type: 'EXPENSE',
        categoryId: { in: budgets.map((budget) => budget.categoryId) },
        occurredAt: { gte: from, lt: to },
      },
    });
    const spentByCategory = new Map(
      spending.map((row) => [row.categoryId, row._sum.amount ?? new Prisma.Decimal(0)]),
    );
    return budgets.map((budget) => ({
      budget,
      spentAmount: (spentByCategory.get(budget.categoryId) ?? new Prisma.Decimal(0)).toString(),
    }));
  }

  async setMonthly(
    userId: string,
    categoryId: string,
    categoryName: string,
    amount: string,
  ): Promise<Budget> {
    return prisma.budget.upsert({
      where: { userId_categoryId_period: { userId, categoryId, period: 'MONTHLY' } },
      create: { userId, categoryId, name: categoryName, amount, period: 'MONTHLY' },
      update: { name: categoryName, amount, deletedAt: null, endsAt: null },
    });
  }

  async softDelete(userId: string, categoryId: string): Promise<number> {
    const result = await prisma.budget.updateMany({
      where: { userId, categoryId, period: 'MONTHLY', deletedAt: null },
      data: { deletedAt: new Date() },
    });
    return result.count;
  }
}

export const budgetRepository: BudgetRepository = new PrismaBudgetRepository();
