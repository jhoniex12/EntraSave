import { Router } from 'express';
import { listBudgets, budgetStatus, setBudget, deleteBudget } from '@/controllers/budget.controller';

/** Budgets — URL wiring. */
export const budgetRoutes = Router();

budgetRoutes.post('/list', listBudgets);
budgetRoutes.post('/status', budgetStatus);
budgetRoutes.post('/set', setBudget);
budgetRoutes.post('/delete', deleteBudget);
