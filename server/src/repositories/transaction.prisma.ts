import { Prisma, type Transaction } from '@prisma/client';
import { prisma } from '@/config/prisma';
import type {
  TransactionRepository,
  CreateTransactionData,
  UpdateTransactionData,
  ListTransactionsParams,
  MonthSummary,
  MonthCategorySummary,
} from '@/repositories/transaction.repository';

/**
 * Transactions — Prisma adapter (ARCHITECTURE.md §1, §10, §11). The ONLY place
 * Prisma is touched for transactions. Parameterized queries only; every query
 * scoped to `userId` + `deletedAt: null`. List uses keyset pagination against
 * the `[userId, occurredAt]` index.
 */
class PrismaTransactionRepository implements TransactionRepository {
  async create(data: CreateTransactionData): Promise<Transaction> {
    return prisma.transaction.create({
      data: {
        userId: data.userId,
        accountId: data.accountId,
        categoryId: data.categoryId,
        type: data.type,
        amount: data.amount, // string -> Decimal(19,4)
        currency: data.currency,
        description: data.description,
        notes: data.notes,
        occurredAt: data.occurredAt,
      },
    });
  }

  async findByIdForUser(userId: string, id: string): Promise<Transaction | null> {
    return prisma.transaction.findFirst({
      where: { id, userId, deletedAt: null },
    });
  }

  async list(params: ListTransactionsParams): Promise<Transaction[]> {
    const where: Prisma.TransactionWhereInput = {
      userId: params.userId,
      deletedAt: null,
      ...(params.accountId ? { accountId: params.accountId } : {}),
      ...(params.categoryId ? { categoryId: params.categoryId } : {}),
    };

    // Date-range filter (e.g. a single month).
    if (params.from || params.to) {
      where.occurredAt = {
        ...(params.from ? { gte: params.from } : {}),
        ...(params.to ? { lt: params.to } : {}),
      };
    }

    // Keyset seek: rows strictly "older" than the cursor in (occurredAt, id) DESC.
    if (params.cursor) {
      where.OR = [
        { occurredAt: { lt: params.cursor.occurredAt } },
        { occurredAt: params.cursor.occurredAt, id: { lt: params.cursor.id } },
      ];
    }

    return prisma.transaction.findMany({
      where,
      orderBy: [{ occurredAt: 'desc' }, { id: 'desc' }],
      take: params.pageSize,
    });
  }

  async monthSummary(
    userId: string,
    from: Date,
    to: Date,
    openingTotal: string,
    startingOverride: string | null,
  ): Promise<MonthSummary> {
    const inMonth = { userId, deletedAt: null, occurredAt: { gte: from, lt: to } };
    const sum = (where: object, type: 'INCOME' | 'EXPENSE') =>
      prisma.transaction.aggregate({ _sum: { amount: true }, where: { ...where, type } });

    const [mInc, mExp] = await Promise.all([sum(inMonth, 'INCOME'), sum(inMonth, 'EXPENSE')]);
    const income = mInc._sum.amount ?? new Prisma.Decimal(0);
    const expense = mExp._sum.amount ?? new Prisma.Decimal(0);
    const net = income.minus(expense);

    let startingBalance: Prisma.Decimal;
    if (startingOverride !== null) {
      startingBalance = new Prisma.Decimal(startingOverride);
    } else {
      // Computed running balance: opening total + net of everything before the month.
      const before = { userId, deletedAt: null, occurredAt: { lt: from } };
      const [bInc, bExp] = await Promise.all([sum(before, 'INCOME'), sum(before, 'EXPENSE')]);
      const netBefore = (bInc._sum.amount ?? new Prisma.Decimal(0)).minus(
        bExp._sum.amount ?? new Prisma.Decimal(0),
      );
      startingBalance = new Prisma.Decimal(openingTotal).plus(netBefore);
    }
    const currentBalance = startingBalance.plus(net);

    return {
      income: income.toString(),
      expense: expense.toString(),
      net: net.toString(),
      startingBalance: startingBalance.toString(),
      currentBalance: currentBalance.toString(),
      isManualStart: startingOverride !== null,
    };
  }

  async monthCategorySummary(
    userId: string,
    from: Date,
    to: Date,
    categoryId?: string,
  ): Promise<MonthCategorySummary[]> {
    const rows = await prisma.transaction.groupBy({
      by: ['categoryId', 'type'],
      _sum: { amount: true },
      where: {
        userId,
        deletedAt: null,
        type: { in: ['INCOME', 'EXPENSE'] },
        ...(categoryId ? { categoryId } : {}),
        occurredAt: { gte: from, lt: to },
      },
    });
    return rows
      .filter((row) => row.type === 'INCOME' || row.type === 'EXPENSE')
      .map((row) => ({
        categoryId: row.categoryId,
        type: row.type === 'INCOME' ? 'INCOME' as const : 'EXPENSE' as const,
        amount: row._sum.amount?.toString() ?? '0',
      }));
  }

  async update(userId: string, id: string, data: UpdateTransactionData): Promise<Transaction> {
    const result = await prisma.transaction.updateMany({
      where: { id, userId, deletedAt: null },
      data,
    });
    if (result.count === 0) {
      throw new Error('TRANSACTION_NOT_FOUND');
    }
    return prisma.transaction.findFirstOrThrow({ where: { id, userId } });
  }

  async softDelete(userId: string, id: string): Promise<number> {
    const result = await prisma.transaction.updateMany({
      where: { id, userId, deletedAt: null },
      data: { deletedAt: new Date() },
    });
    return result.count;
  }
}

export const transactionRepository: TransactionRepository = new PrismaTransactionRepository();
