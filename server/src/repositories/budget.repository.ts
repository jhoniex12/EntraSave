import type { Budget } from '@prisma/client';

export interface BudgetSpendingRow {
  budget: Budget;
  spentAmount: string;
}

export interface BudgetRepository {
  listForUser(userId: string): Promise<Budget[]>;
  listWithSpending(userId: string, from: Date, to: Date): Promise<BudgetSpendingRow[]>;
  setMonthly(userId: string, categoryId: string, categoryName: string, amount: string): Promise<Budget>;
  softDelete(userId: string, categoryId: string): Promise<number>;
}
