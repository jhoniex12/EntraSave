import { Prisma, type Account } from '@prisma/client';
import { prisma } from '@/config/prisma';
import type {
  AccountRepository,
  AccountFinancialSummaryRecord,
  CreateAccountData,
  UpdateAccountData,
} from '@/repositories/account.repository';

/**
 * Accounts — Prisma adapter (ARCHITECTURE.md §1, §11). The ONLY place Prisma is
 * touched for accounts. All queries are parameterized by Prisma (no string SQL)
 * and scoped to `userId` + `deletedAt: null`.
 */
class PrismaAccountRepository implements AccountRepository {
  async create(data: CreateAccountData): Promise<Account> {
    return prisma.account.create({
      data: {
        userId: data.userId,
        name: data.name,
        type: data.type,
        currency: data.currency,
        balance: data.openingBalance, // Prisma coerces the string into Decimal(19,4)
      },
    });
  }

  async findByIdForUser(userId: string, id: string): Promise<Account | null> {
    return prisma.account.findFirst({
      where: { id, userId, deletedAt: null },
    });
  }

  async listForUser(userId: string, includeArchived: boolean): Promise<Account[]> {
    return prisma.account.findMany({
      where: {
        userId,
        deletedAt: null,
        ...(includeArchived ? {} : { isArchived: false }),
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async listSummariesForUser(
    userId: string,
    includeArchived: boolean,
    monthStart: Date,
    monthEnd: Date,
  ): Promise<AccountFinancialSummaryRecord[]> {
    const accountWhere = {
      userId,
      deletedAt: null,
      ...(includeArchived ? {} : { isArchived: false }),
    };
    const [accounts, throughMonth, inMonth] = await Promise.all([
      prisma.account.findMany({ where: accountWhere, orderBy: { createdAt: 'desc' } }),
      prisma.transaction.groupBy({
        by: ['accountId', 'type'],
        _sum: { amount: true },
        where: {
          userId,
          deletedAt: null,
          type: { in: ['INCOME', 'EXPENSE'] },
          occurredAt: { lt: monthEnd },
          account: accountWhere,
        },
      }),
      prisma.transaction.groupBy({
        by: ['accountId', 'type'],
        _sum: { amount: true },
        where: {
          userId,
          deletedAt: null,
          type: { in: ['INCOME', 'EXPENSE'] },
          occurredAt: { gte: monthStart, lt: monthEnd },
          account: accountWhere,
        },
      }),
    ]);

    const totals = aggregateByAccount(throughMonth);
    const monthly = aggregateByAccount(inMonth);
    return accounts.map((account) => {
      const total = totals.get(account.id) ?? zeroSummary();
      const month = monthly.get(account.id) ?? zeroSummary();
      return {
        account,
        currentBalance: account.balance.plus(total.income).minus(total.expense).toString(),
        incomeThisMonth: month.income.toString(),
        expenseThisMonth: month.expense.toString(),
        netThisMonth: month.income.minus(month.expense).toString(),
      };
    });
  }

  async totalBalance(userId: string): Promise<string> {
    const result = await prisma.account.aggregate({
      _sum: { balance: true },
      where: { userId, deletedAt: null },
    });
    return result._sum.balance?.toString() ?? '0';
  }

  async update(userId: string, id: string, data: UpdateAccountData): Promise<Account> {
    // updateMany enforces ownership in the WHERE; a direct update(by id) would not.
    const result = await prisma.account.updateMany({
      where: { id, userId, deletedAt: null },
      data,
    });
    if (result.count === 0) {
      throw new Error('ACCOUNT_NOT_FOUND'); // mapped to NotFoundError in the service
    }
    // Safe to read back: ownership already proven above.
    return prisma.account.findFirstOrThrow({ where: { id, userId } });
  }

  async softDeleteWithTransactions(
    userId: string,
    id: string,
  ): Promise<{ accountCount: number; transactionCount: number }> {
    return prisma.$transaction(async (tx) => {
      const deletedAt = new Date();
      const account = await tx.account.updateMany({
        where: { id, userId, deletedAt: null },
        data: { deletedAt },
      });
      if (account.count === 0) {
        throw new Error('ACCOUNT_NOT_FOUND');
      }
      const transactions = await tx.transaction.updateMany({
        where: { accountId: id, userId, deletedAt: null },
        data: { deletedAt },
      });
      return { accountCount: account.count, transactionCount: transactions.count };
    });
  }
}

interface DecimalSummary {
  income: Prisma.Decimal;
  expense: Prisma.Decimal;
}

function aggregateByAccount(
  rows: Array<{ accountId: string; type: string; _sum: { amount: Prisma.Decimal | null } }>,
): Map<string, DecimalSummary> {
  const summaries = new Map<string, DecimalSummary>();
  for (const row of rows) {
    const summary = summaries.get(row.accountId) ?? zeroSummary();
    if (row.type === 'INCOME') summary.income = row._sum.amount ?? new Prisma.Decimal(0);
    if (row.type === 'EXPENSE') summary.expense = row._sum.amount ?? new Prisma.Decimal(0);
    summaries.set(row.accountId, summary);
  }
  return summaries;
}

function zeroSummary(): DecimalSummary {
  return { income: new Prisma.Decimal(0), expense: new Prisma.Decimal(0) };
}

export const accountRepository: AccountRepository = new PrismaAccountRepository();
