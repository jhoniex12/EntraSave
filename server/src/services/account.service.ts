import type { AuthContext } from '@/utils/auth-context';
import { NotFoundError, ValidationError } from '@/utils/app-error';
import { accountRepository } from '@/repositories/account.prisma';
import type { AccountRepository } from '@/repositories/account.repository';
import {
  toAccountDTO,
  type AccountDTO,
  type AccountSummaryDTO,
} from '@/dto/account.dto';
import type {
  CreateAccountInput,
  UpdateAccountInput,
  DeleteAccountInput,
  ListAccountsInput,
} from '@/schemas/account.schema';

/**
 * Accounts — service layer (ARCHITECTURE.md §8, §10). Business logic lives ONLY
 * here. Receives the validated input + `ctx` (never re-reads the request) and
 * returns DTOs. Depends on the repository INTERFACE; the concrete Prisma adapter
 * is injected so the service stays persistence-agnostic and testable.
 */
export class AccountService {
  constructor(private readonly repo: AccountRepository) {}

  async create(ctx: AuthContext, input: CreateAccountInput): Promise<AccountDTO> {
    const account = await this.repo.create({
      userId: ctx.userId,
      name: input.name,
      type: input.type,
      currency: input.currency,
      openingBalance: input.openingBalance,
    });
    return toAccountDTO(account);
  }

  async list(ctx: AuthContext, input: ListAccountsInput): Promise<AccountDTO[]> {
    const accounts = await this.repo.listForUser(ctx.userId, input.includeArchived);
    return accounts.map(toAccountDTO);
  }

  async listWithSummary(
    ctx: AuthContext,
    input: ListAccountsInput,
  ): Promise<AccountSummaryDTO[]> {
    const now = new Date();
    const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
    const monthEnd = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1));
    const records = await this.repo.listSummariesForUser(
      ctx.userId,
      input.includeArchived,
      monthStart,
      monthEnd,
    );
    return records.map((record) => ({
      ...toAccountDTO(record.account),
      currentBalance: record.currentBalance,
      incomeThisMonth: record.incomeThisMonth,
      expenseThisMonth: record.expenseThisMonth,
      netThisMonth: record.netThisMonth,
    }));
  }

  /** Sum of opening balances across the user's accounts (Decimal string). */
  async totalBalance(ctx: AuthContext): Promise<string> {
    return this.repo.totalBalance(ctx.userId);
  }

  async getOwned(ctx: AuthContext, id: string): Promise<AccountDTO> {
    const account = await this.repo.findByIdForUser(ctx.userId, id);
    if (!account) throw new NotFoundError('Account not found');
    return toAccountDTO(account);
  }

  /** Ownership assertion used by the action wrapper's `ownership` hook. */
  async assertOwned(ctx: AuthContext, id: string): Promise<void> {
    const account = await this.repo.findByIdForUser(ctx.userId, id);
    if (!account) throw new NotFoundError('Account not found');
  }

  async update(ctx: AuthContext, input: UpdateAccountInput): Promise<AccountDTO> {
    try {
      const account = await this.repo.update(ctx.userId, input.id, {
        name: input.name,
        type: input.type,
        balance: input.openingBalance,
        isArchived: input.isArchived,
      });
      return toAccountDTO(account);
    } catch (err) {
      if (err instanceof Error && err.message === 'ACCOUNT_NOT_FOUND') {
        throw new NotFoundError('Account not found');
      }
      throw err;
    }
  }

  async remove(
    ctx: AuthContext,
    input: DeleteAccountInput,
  ): Promise<{ id: string; deletedTransactions: number }> {
    const account = await this.repo.findByIdForUser(ctx.userId, input.id);
    if (!account) throw new NotFoundError('Account not found');
    if (input.confirmation !== account.name) {
      throw new ValidationError(
        { confirmation: ['Enter the exact account name to confirm deletion'] },
        'Account name does not match',
      );
    }

    try {
      const result = await this.repo.softDeleteWithTransactions(ctx.userId, input.id);
      return { id: input.id, deletedTransactions: result.transactionCount };
    } catch (err) {
      if (err instanceof Error && err.message === 'ACCOUNT_NOT_FOUND') {
        throw new NotFoundError('Account not found');
      }
      throw err;
    }
  }
}

export const accountService = new AccountService(accountRepository);
