import type { Budget } from '@prisma/client';
import { decimalToString } from '@/utils/money';

export interface BudgetDTO {
  id: string;
  categoryId: string;
  amount: string;
  period: 'MONTHLY';
}

export interface BudgetStatusDTO {
  categoryId: string;
  budgetAmount: string;
  spentAmount: string;
  usagePercent: number;
  status: 'SAFE' | 'NEAR' | 'OVER';
}

export interface BudgetYearStatusDTO {
  year: number;
  /** Zero-based month positions: 0 = January. */
  months: BudgetStatusDTO[][];
}

export function toBudgetDTO(budget: Budget): BudgetDTO {
  return {
    id: budget.id,
    categoryId: budget.categoryId,
    amount: decimalToString(budget.amount),
    period: 'MONTHLY',
  };
}
