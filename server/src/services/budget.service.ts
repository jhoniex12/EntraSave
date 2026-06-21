import type { AuthContext } from '@/utils/auth-context';
import { ValidationError } from '@/utils/app-error';
import { categoryService } from '@/services/category.service';
import { budgetRepository } from '@/repositories/budget.prisma';
import type { BudgetRepository } from '@/repositories/budget.repository';
import { toBudgetDTO, type BudgetDTO, type BudgetStatusDTO } from '@/dto/budget.dto';
import type { SetBudgetInput } from '@/schemas/budget.schema';

export class BudgetService {
  constructor(private readonly repo: BudgetRepository) {}

  async list(ctx: AuthContext): Promise<BudgetDTO[]> {
    return (await this.repo.listForUser(ctx.userId)).map(toBudgetDTO);
  }

  async set(ctx: AuthContext, input: SetBudgetInput): Promise<BudgetDTO> {
    const category = await categoryService.getOwned(ctx, input.categoryId);
    if (category.kind !== 'EXPENSE') {
      throw new ValidationError({ categoryId: ['Budgets can only be set for expense categories'] });
    }
    if (moneyUnits(input.amount) <= 0n) {
      throw new ValidationError({ amount: ['Budget must be greater than zero'] });
    }
    return toBudgetDTO(
      await this.repo.setMonthly(ctx.userId, category.id, category.name, input.amount),
    );
  }

  async remove(ctx: AuthContext, categoryId: string): Promise<{ categoryId: string }> {
    await categoryService.assertOwned(ctx, categoryId);
    await this.repo.softDelete(ctx.userId, categoryId);
    return { categoryId };
  }

  async getMonthStatus(ctx: AuthContext, year: number, month: number): Promise<BudgetStatusDTO[]> {
    const from = new Date(Date.UTC(year, month, 1));
    const to = new Date(Date.UTC(year, month + 1, 1));
    const rows = await this.repo.listWithSpending(ctx.userId, from, to);
    return rows.map(({ budget, spentAmount }) => {
      const budgetAmount = budget.amount.toString();
      const budgetUnits = moneyUnits(budgetAmount);
      const spentUnits = moneyUnits(spentAmount);
      const usageBasisPoints = budgetUnits === 0n ? 0n : (spentUnits * 10_000n) / budgetUnits;
      return {
        categoryId: budget.categoryId,
        budgetAmount,
        spentAmount,
        usagePercent: Number(usageBasisPoints) / 100,
        status: spentUnits > budgetUnits ? 'OVER' : usageBasisPoints >= 8_000n ? 'NEAR' : 'SAFE',
      };
    });
  }
}

function moneyUnits(value: string): bigint {
  const [whole = '0', fraction = ''] = value.split('.');
  return BigInt(whole) * 10_000n + BigInt(fraction.padEnd(4, '0').slice(0, 4) || '0');
}

export const budgetService = new BudgetService(budgetRepository);
