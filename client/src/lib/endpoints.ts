import { get, post } from '@/lib/api';
import type {
  AccountDTO,
  AccountSummaryDTO,
  BudgetDTO,
  BudgetStatusDTO,
  BudgetYearStatusDTO,
  CategoryDTO,
  DashboardSummaryDTO,
  MonthResponse,
  Page,
  TransactionDTO,
  UserProfileDTO,
  VaultItemDTO,
  VaultKeyDTO,
  VaultStateDTO,
} from '@/lib/types';

/**
 * One typed function per API endpoint (CODING_STANDARDS.md §3). Mirrors the
 * server routers in server/src/modules/.../*.routes.ts. Names match the action
 * names so the mapping is obvious in review.
 */
export const api = {
  auth: {
    providers: () => get<{ googleEnabled: boolean; facebookEnabled: boolean }>('/auth/providers'),
    signIn: (input: { email: string; password: string }) =>
      post<{ authenticated: true }>('/auth/signin', input),
    signUp: (input: { email: string; password: string; displayName?: string }) =>
      post<{ authenticated: true }>('/auth/signup', input),
    unlink: (provider: 'google' | 'facebook') =>
      post<{ provider: string; unlinked: true }>('/auth/unlink', { provider }),
  },

  accounts: {
    list: (includeArchived = false) =>
      post<AccountDTO[]>('/accounts/list', { includeArchived }),
    summary: (includeArchived = false) =>
      post<AccountSummaryDTO[]>('/accounts/summary', { includeArchived }),
    create: (input: {
      name: string;
      type: string;
      currency: string;
      openingBalance: string;
      idempotencyKey?: string;
    }) => post<AccountDTO>('/accounts/create', input),
    update: (input: {
      id: string;
      name?: string;
      type?: string;
      openingBalance?: string;
      isArchived?: boolean;
    }) => post<AccountDTO>('/accounts/update', input),
    reorder: (orderedIds: string[]) =>
      post<{ count: number }>('/accounts/reorder', { orderedIds }),
    remove: (input: { id: string; confirmation: string }) =>
      post<{ id: string; deletedTransactions: number }>('/accounts/delete', input),
  },

  transactions: {
    list: (input: { accountId?: string; categoryId?: string; pageSize?: number; cursor?: string } = {}) =>
      post<Page<TransactionDTO>>('/transactions/list', input),
    month: (input: { year: number; month: number; categoryId?: string; accountId?: string; period?: 'month' | 'year'; cursor?: string }) =>
      post<MonthResponse>('/transactions/month', input),
    create: (input: {
      accountId: string;
      categoryId?: string;
      type: string;
      amount: string;
      description?: string;
      notes?: string;
      occurredAt: string;
      idempotencyKey?: string;
    }) => post<TransactionDTO>('/transactions/create', input),
    transfer: (input: {
      fromAccountId: string;
      toAccountId: string;
      amount: string;
      description?: string;
      occurredAt: string;
      idempotencyKey?: string;
    }) => post<{ out: TransactionDTO; in: TransactionDTO }>('/transactions/transfer', input),
    update: (input: {
      id: string;
      categoryId?: string | null;
      amount?: string;
      description?: string | null;
      notes?: string | null;
      occurredAt?: string;
    }) => post<TransactionDTO>('/transactions/update', input),
    remove: (input: { id: string }) => post<{ id: string }>('/transactions/delete', input),
  },

  categories: {
    list: () => post<CategoryDTO[]>('/categories/list', {}),
    create: (input: { name: string; kind: string; color?: string }) =>
      post<CategoryDTO>('/categories/create', input),
    update: (input: { id: string; name: string; kind: string; color?: string }) =>
      post<CategoryDTO>('/categories/update', input),
    remove: (input: { id: string }) =>
      post<{ id: string; hardDeleted: boolean }>('/categories/delete', input),
    reorder: (orderedIds: string[]) =>
      post<{ count: number }>('/categories/reorder', { orderedIds }),
  },

  budgets: {
    list: () => post<BudgetDTO[]>('/budgets/list', {}),
    status: (input: { year: number; month: number }) =>
      post<BudgetStatusDTO[]>('/budgets/status', input),
    yearStatus: (year: number) => post<BudgetYearStatusDTO>('/budgets/year-status', { year }),
    set: (input: { categoryId: string; amount: string }) =>
      post<BudgetDTO>('/budgets/set', input),
    remove: (categoryId: string) =>
      post<{ categoryId: string }>('/budgets/delete', { categoryId }),
  },

  balances: {
    set: (input: { year: number; month: number; startingBalance: string }) =>
      post<{ ok: boolean }>('/balances/set', input),
    reset: (input: { year: number; month: number }) =>
      post<{ ok: boolean }>('/balances/reset', input),
  },

  dashboard: {
    summary: (input: { accountId?: string } = {}) => post<DashboardSummaryDTO>('/dashboard/summary', input),
  },

  users: {
    profile: () => post<UserProfileDTO>('/users/profile', {}),
    updateCurrency: (input: { currency: string }) =>
      post<{ currency: string }>('/users/currency', input),
    updateProfile: (input: { displayName: string }) =>
      post<{ displayName: string }>('/users/profile/update', input),
  },

  vault: {
    state: () => post<VaultStateDTO>('/vault/state', {}),
    setup: (input: { kdfSalt: string; kdfIterations: number; pinProof: string; secret: string }) =>
      post<VaultKeyDTO>('/vault/setup', input),
    unlock: (pinProof: string) => post<{ secret: string }>('/vault/unlock', { pinProof }),
    list: () => post<VaultItemDTO[]>('/vault/list', {}),
    create: (input: { keyVersion: number; iv: string; ciphertext: string }) =>
      post<VaultItemDTO>('/vault/create', input),
    update: (input: { id: string; keyVersion: number; iv: string; ciphertext: string }) =>
      post<VaultItemDTO>('/vault/update', input),
    remove: (id: string) => post<{ id: string }>('/vault/delete', { id }),
    rekey: (input: {
      keyVersion: number;
      kdfSalt: string;
      kdfIterations: number;
      pinProof: string;
      secret: string;
      currentPinProof?: string;
      items: Array<{ id: string; iv: string; ciphertext: string }>;
    }) => post<VaultKeyDTO>('/vault/rekey', input),
    reset: () => post<{ reset: true }>('/vault/reset', { confirmation: 'DELETE' }),
  },
};
