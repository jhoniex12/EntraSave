import type { AuthContext } from '@/utils/auth-context';
import { balanceRepository } from '@/repositories/balance.prisma';
import type { BalanceRepository } from '@/repositories/balance.repository';
import type {
  SetStartingBalanceInput,
  ResetStartingBalanceInput,
} from '@/schemas/balance.schema';

/**
 * Monthly balance — service layer (ARCHITECTURE.md §8). Owns get/set/reset of a
 * user's per-month starting balance override.
 */
export class BalanceService {
  constructor(private readonly repo: BalanceRepository) {}

  /** The override starting balance for a month, or null if none is set. */
  async getStartingBalance(ctx: AuthContext, year: number, month: number): Promise<string | null> {
    return this.repo.getForMonth(ctx.userId, year, month);
  }

  async setStartingBalance(ctx: AuthContext, input: SetStartingBalanceInput): Promise<void> {
    await this.repo.upsertForMonth(ctx.userId, input.year, input.month, input.startingBalance);
  }

  async resetStartingBalance(ctx: AuthContext, input: ResetStartingBalanceInput): Promise<void> {
    await this.repo.removeForMonth(ctx.userId, input.year, input.month);
  }
}

export const balanceService = new BalanceService(balanceRepository);
