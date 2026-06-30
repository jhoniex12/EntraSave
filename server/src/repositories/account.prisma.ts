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
    // Idempotent create: a retried submit with the same key returns the row the
    // first request inserted instead of a duplicate account. Pre-check, then fall
    // back to re-reading on the unique-index race.
    if (data.idempotencyKey) {
      const existing = await this.findByIdempotencyKey(data.userId, data.idempotencyKey);
      if (existing) return existing;
    }
    try {
      return await prisma.account.create({
        data: {
          userId: data.userId,
          name: data.name,
          type: data.type,
          currency: data.currency,
          balance: data.openingBalance, // Prisma coerces the string into Decimal(19,4)
          position: data.position,
          idempotencyKey: data.idempotencyKey,
        },
      });
    } catch (error) {
      if (data.idempotencyKey && isUniqueConstraintError(error)) {
        const existing = await this.findByIdempotencyKey(data.userId, data.idempotencyKey);
        if (existing) return existing;
      }
      throw error;
    }
  }

  private findByIdempotencyKey(userId: string, idempotencyKey: string): Promise<Account | null> {
    return prisma.account.findFirst({ where: { userId, idempotencyKey } });
  }

  async hasAccounts(userId: string): Promise<boolean> {
    const existing = await prisma.account.findFirst({
      where: { userId, deletedAt: null },
      select: { id: true },
    });
    return existing !== null;
  }

  async countForUser(userId: string): Promise<number> {
    return prisma.account.count({ where: { userId, deletedAt: null } });
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
      // Default order is oldest-first; user-defined `position` takes precedence
      // once accounts have been reordered.
      orderBy: [{ position: 'asc' }, { createdAt: 'asc' }],
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
      prisma.account.findMany({ where: accountWhere, orderBy: [{ position: 'asc' }, { createdAt: 'asc' }] }),
      prisma.transaction.groupBy({
        by: ['accountId', 'type'],
        _sum: { amount: true },
        where: {
          userId,
          deletedAt: null,
          // Transfer legs move money between accounts, so they count toward each
          // account's running balance (but never toward income/expense totals).
          type: { in: ['INCOME', 'EXPENSE', 'TRANSFER_IN', 'TRANSFER_OUT'] },
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
          // Each account treats a transfer as income (money in) or expense (money
          // out), so transfer legs are pulled in and folded into this account's
          // income/expense totals below.
          type: { in: ['INCOME', 'EXPENSE', 'TRANSFER_IN', 'TRANSFER_OUT'] },
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
        currentBalance: account.balance
          .plus(total.income)
          .plus(total.transferIn)
          .minus(total.expense)
          .minus(total.transferOut)
          .toString(),
        incomeThisMonth: month.income.plus(month.transferIn).toString(),
        expenseThisMonth: month.expense.plus(month.transferOut).toString(),
        netThisMonth: month.income
          .plus(month.transferIn)
          .minus(month.expense)
          .minus(month.transferOut)
          .toString(),
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

  async setPositions(userId: string, orderedIds: string[]): Promise<void> {
    // Ownership enforced in each WHERE; non-owned ids are simply no-ops.
    await prisma.$transaction(
      orderedIds.map((id, index) =>
        prisma.account.updateMany({
          where: { id, userId, deletedAt: null },
          data: { position: index },
        }),
      ),
    );
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
      // Transfers touching this account have a paired leg on a DIFFERENT account.
      // Collect those transfer ids first so we can also remove the counterpart
      // legs and never leave a one-sided transfer behind.
      const transferLegs = await tx.transaction.findMany({
        where: { accountId: id, userId, deletedAt: null, transferId: { not: null } },
        select: { transferId: true },
      });
      const transferIds = transferLegs
        .map((leg) => leg.transferId)
        .filter((value): value is string => value !== null);

      const transactions = await tx.transaction.updateMany({
        where: { accountId: id, userId, deletedAt: null },
        data: { deletedAt },
      });
      if (transferIds.length > 0) {
        await tx.transaction.updateMany({
          where: { userId, transferId: { in: transferIds }, deletedAt: null },
          data: { deletedAt },
        });
      }
      return { accountCount: account.count, transactionCount: transactions.count };
    });
  }
}

interface DecimalSummary {
  income: Prisma.Decimal;
  expense: Prisma.Decimal;
  transferIn: Prisma.Decimal;
  transferOut: Prisma.Decimal;
}

function aggregateByAccount(
  rows: Array<{ accountId: string; type: string; _sum: { amount: Prisma.Decimal | null } }>,
): Map<string, DecimalSummary> {
  const summaries = new Map<string, DecimalSummary>();
  for (const row of rows) {
    const summary = summaries.get(row.accountId) ?? zeroSummary();
    const amount = row._sum.amount ?? new Prisma.Decimal(0);
    if (row.type === 'INCOME') summary.income = amount;
    if (row.type === 'EXPENSE') summary.expense = amount;
    if (row.type === 'TRANSFER_IN') summary.transferIn = amount;
    if (row.type === 'TRANSFER_OUT') summary.transferOut = amount;
    summaries.set(row.accountId, summary);
  }
  return summaries;
}

function zeroSummary(): DecimalSummary {
  return {
    income: new Prisma.Decimal(0),
    expense: new Prisma.Decimal(0),
    transferIn: new Prisma.Decimal(0),
    transferOut: new Prisma.Decimal(0),
  };
}

function isUniqueConstraintError(error: unknown): boolean {
  return typeof error === 'object' && error !== null && 'code' in error && error.code === 'P2002';
}

export const accountRepository: AccountRepository = new PrismaAccountRepository();
