import { Router } from 'express';
import { listBudgets, budgetStatus, budgetYearStatus, setBudget, deleteBudget } from '@/controllers/budget.controller';

/** Budgets — URL wiring. */
export const budgetRoutes = Router();

budgetRoutes.post('/list', listBudgets);
budgetRoutes.post('/status', budgetStatus);
budgetRoutes.post('/year-status', budgetYearStatus);
budgetRoutes.post('/set', setBudget);
budgetRoutes.post('/delete', deleteBudget);
