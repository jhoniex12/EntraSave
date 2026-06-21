import type { AuthContext } from '@/utils/auth-context';
import { NotFoundError, ValidationError } from '@/utils/app-error';
import type { Page } from '@/utils/pagination';
import { clampPageSize } from '@/utils/pagination';
import { accountService } from '@/services/account.service';
import { categoryService } from '@/services/category.service';
import { balanceService } from '@/services/balance.service';
import { transactionRepository } from '@/repositories/transaction.prisma';
import type { TransactionRepository } from '@/repositories/transaction.repository';
import { toTransactionDTO, type TransactionDTO } from '@/dto/transaction.dto';
import type {
  CreateTransactionInput,
  UpdateTransactionInput,
  ListTransactionsInput,
} from '@/schemas/transaction.schema';

/**
 * Transactions — service layer (ARCHITECTURE.md §8, §10). Business logic lives
 * ONLY here. Cross-module access (verifying the target account is owned by the
 * caller) goes through the Accounts PUBLIC service, never its internals.
 */
export class TransactionService {
  constructor(private readonly repo: TransactionRepository) {}

  async create(ctx: AuthContext, input: CreateTransactionInput): Promise<TransactionDTO> {
    // Domain rule: you may only post into an account you own. getOwned also gives
    // us the account's currency, which the transaction inherits (server-authoritative).
    const account = await accountService.getOwned(ctx, input.accountId);

    // If a category was chosen, it must belong to the caller too.
    if (input.categoryId) {
      await categoryService.assertOwned(ctx, input.categoryId);
    }

    const tx = await this.repo.create({
      userId: ctx.userId,
      accountId: input.accountId,
      categoryId: input.categoryId,
      type: input.type,
      amount: input.amount,
      currency: account.currency,
      description: input.description,
      notes: input.notes,
      occurredAt: input.occurredAt,
    });
    return toTransactionDTO(tx);
  }

  async list(ctx: AuthContext, input: ListTransactionsInput): Promise<Page<TransactionDTO>> {
    const pageSize = clampPageSize(input.pageSize);
    const cursor = decodeCursor(input.cursor);

    // Fetch one extra row to know whether another page exists.
    const rows = await this.repo.list({
      userId: ctx.userId,
      accountId: input.accountId,
      categoryId: input.categoryId,
      pageSize: pageSize + 1,
      cursor,
    });

    const hasMore = rows.length > pageSize;
    const items = hasMore ? rows.slice(0, pageSize) : rows;
    const last = items.at(-1);
    const nextCursor = hasMore && last ? encodeCursor(last.occurredAt, last.id) : null;

    return { items: items.map(toTransactionDTO), nextCursor };
  }

  /**
   * All transactions for a single calendar month (UTC), newest first, plus the
   * month's income/expense/net totals. `month` is 0-based (0 = January).
   */
  async getMonth(
    ctx: AuthContext,
    year: number,
    month: number,
    categoryId?: string,
  ): Promise<{
    items: TransactionDTO[];
    income: string;
    expense: string;
    net: string;
    startingBalance: string;
    currentBalance: string;
    isManualStart: boolean;
    categorySummary: Array<{
      categoryId: string | null;
      type: 'INCOME' | 'EXPENSE';
      amount: string;
    }>;
  }> {
    if (categoryId) {
      await categoryService.assertOwned(ctx, categoryId);
    }
    const from = new Date(Date.UTC(year, month, 1));
    const to = new Date(Date.UTC(year, month + 1, 1));
    const [rows, summary, categorySummary] = await Promise.all([
      this.repo.list({ userId: ctx.userId, from, to, categoryId, pageSize: 1000 }),
      this.getMonthSummary(ctx, year, month),
      this.repo.monthCategorySummary(ctx.userId, from, to, categoryId),
    ]);
    return { items: rows.map(toTransactionDTO), ...summary, categorySummary };
  }

  /** Current totals for a calendar month without loading its transaction rows. */
  async getMonthSummary(
    ctx: AuthContext,
    year: number,
    month: number,
  ): Promise<{
    income: string;
    expense: string;
    net: string;
    startingBalance: string;
    currentBalance: string;
    isManualStart: boolean;
  }> {
    const from = new Date(Date.UTC(year, month, 1));
    const to = new Date(Date.UTC(year, month + 1, 1));
    // Baseline = sum of account opening balances; override = user-set start (if any).
    const [openingTotal, override] = await Promise.all([
      accountService.totalBalance(ctx),
      balanceService.getStartingBalance(ctx, year, month),
    ]);
    return this.repo.monthSummary(ctx.userId, from, to, openingTotal, override);
  }

  async assertOwned(ctx: AuthContext, id: string): Promise<void> {
    const tx = await this.repo.findByIdForUser(ctx.userId, id);
    if (!tx) throw new NotFoundError('Transaction not found');
  }

  async update(ctx: AuthContext, input: UpdateTransactionInput): Promise<TransactionDTO> {
    if (input.categoryId) {
      await categoryService.assertOwned(ctx, input.categoryId);
    }

    try {
      const tx = await this.repo.update(ctx.userId, input.id, {
        categoryId: input.categoryId,
        amount: input.amount,
        description: input.description,
        notes: input.notes,
        occurredAt: input.occurredAt,
      });
      return toTransactionDTO(tx);
    } catch (err) {
      if (err instanceof Error && err.message === 'TRANSACTION_NOT_FOUND') {
        throw new NotFoundError('Transaction not found');
      }
      throw err;
    }
  }

  async softDelete(ctx: AuthContext, id: string): Promise<{ id: string }> {
    const count = await this.repo.softDelete(ctx.userId, id);
    if (count === 0) throw new NotFoundError('Transaction not found');
    return { id };
  }
}

// ── Opaque keyset cursor codec (base64 of "occurredAtISO|id") ──
function encodeCursor(occurredAt: Date, id: string): string {
  return Buffer.from(`${occurredAt.toISOString()}|${id}`, 'utf8').toString('base64url');
}

function decodeCursor(raw?: string): { occurredAt: Date; id: string } | undefined {
  if (!raw) return undefined;
  try {
    const decoded = Buffer.from(raw, 'base64url').toString('utf8');
    const [iso, id] = decoded.split('|');
    if (!iso || !id) throw new Error('bad cursor');
    const occurredAt = new Date(iso);
    if (Number.isNaN(occurredAt.getTime())) throw new Error('bad cursor');
    return { occurredAt, id };
  } catch {
    throw new ValidationError({ cursor: ['Invalid pagination cursor'] });
  }
}

export const transactionService = new TransactionService(transactionRepository);
