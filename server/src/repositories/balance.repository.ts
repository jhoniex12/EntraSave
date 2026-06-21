/**
 * Monthly balance — repository INTERFACE (ARCHITECTURE.md §1 seam). Scoped by
 * `userId`. Returns the override starting balance for a month, or null.
 */
export interface BalanceRepository {
  getForMonth(userId: string, year: number, month: number): Promise<string | null>;
  upsertForMonth(userId: string, year: number, month: number, startingBalance: string): Promise<void>;
  removeForMonth(userId: string, year: number, month: number): Promise<void>;
}
