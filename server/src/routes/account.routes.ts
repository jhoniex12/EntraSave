import { Router } from 'express';
import {
  listAccounts,
  accountSummary,
  createAccount,
  updateAccount,
  deleteAccount,
} from '@/controllers/account.controller';

/** Accounts — URL wiring. Controllers hold the policy + logic. */
export const accountRoutes = Router();

accountRoutes.post('/list', listAccounts);
accountRoutes.post('/summary', accountSummary);
accountRoutes.post('/create', createAccount);
accountRoutes.post('/update', updateAccount);
accountRoutes.post('/delete', deleteAccount);
