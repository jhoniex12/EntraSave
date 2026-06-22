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
  CreateTransferInput,
  UpdateTransactionInput,
  ListTransactionsInput,
} from '@/schemas/transaction.schema';

/**
 * Transactions — service layer (ARCHITECTURE.md §8, §10). Business logic lives
 * ONLY here. Cross-module access (verifying the target account is owned by the
 * caller) goes through the Accounts PUBLIC service, never its internals.
 */
/** Page size for the month/year transaction list (keyset-paginated). */
const MONTH_PAGE_SIZE = 100;

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
      idempotencyKey: input.idempotencyKey,
    });
    return toTransactionDTO(tx);
  }

  /**
   * Move money between two of the caller's own accounts as one atomic unit.
   * Both accounts must be owned by the caller and share a currency (cross-currency
   * transfers need an FX policy that does not exist yet). The repository writes
   * the two legs in a single DB transaction.
   */
  async createTransfer(
    ctx: AuthContext,
    input: CreateTransferInput,
  ): Promise<{ out: TransactionDTO; in: TransactionDTO }> {
    const [from, to] = await Promise.all([
      accountService.getOwned(ctx, input.fromAccountId),
      accountService.getOwned(ctx, input.toAccountId),
    ]);
    if (from.currency !== to.currency) {
      throw new ValidationError(
        { toAccountId: ['Both accounts must use the same currency'] },
        'Cross-currency transfers are not supported',
      );
    }

    const legs = await this.repo.createTransfer({
      userId: ctx.userId,
      fromAccountId: input.fromAccountId,
      toAccountId: input.toAccountId,
      amount: input.amount,
      currency: from.currency,
      description: input.description,
      occurredAt: input.occurredAt,
      idempotencyKey: input.idempotencyKey,
    });
    return { out: toTransactionDTO(legs.out), in: toTransactionDTO(legs.in) };
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
    accountId?: string,
    period: 'month' | 'year' = 'month',
    cursor?: string,
  ): Promise<{
    items: TransactionDTO[];
    nextCursor: string | null;
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
    // The account filter narrows the transaction list (and per-category totals);
    // verifying ownership also blocks scoping by an account the caller doesn't own.
    if (accountId) {
      await accountService.assertOwned(ctx, accountId);
    }
    const isYear = period === 'year';
    const from = new Date(Date.UTC(year, isYear ? 0 : month, 1));
    const to = new Date(Date.UTC(isYear ? year + 1 : year, isYear ? 0 : month + 1, 1));
    // The user-set starting-balance override is a per-month concept; a year view
    // always uses the computed running balance.
    const [openingTotal, override] = await Promise.all([
      accountService.totalBalance(ctx),
      isYear ? Promise.resolve(null) : balanceService.getStartingBalance(ctx, year, month),
    ]);
    // Keyset pagination: fetch one extra row to know whether another page exists.
    const seek = decodeCursor(cursor);
    const [rows, summary, categorySummary] = await Promise.all([
      this.repo.list({ userId: ctx.userId, from, to, categoryId, accountId, cursor: seek, pageSize: MONTH_PAGE_SIZE + 1 }),
      this.repo.monthSummary(ctx.userId, from, to, openingTotal, override),
      this.repo.monthCategorySummary(ctx.userId, from, to, categoryId, accountId),
    ]);
    const hasMore = rows.length > MONTH_PAGE_SIZE;
    const items = hasMore ? rows.slice(0, MONTH_PAGE_SIZE) : rows;
    const last = items.at(-1);
    const nextCursor = hasMore && last ? encodeCursor(last.occurredAt, last.id) : null;
    return { items: items.map(toTransactionDTO), nextCursor, ...summary, categorySummary };
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
