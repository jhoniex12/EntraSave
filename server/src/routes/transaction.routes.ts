import { Router } from 'express';
import {
  listTransactions,
  transactionMonth,
  createTransaction,
  createTransfer,
  updateTransaction,
  deleteTransaction,
} from '@/controllers/transaction.controller';

/** Transactions — URL wiring. */
export const transactionRoutes = Router();

transactionRoutes.post('/list', listTransactions);
transactionRoutes.post('/month', transactionMonth);
transactionRoutes.post('/create', createTransaction);
transactionRoutes.post('/transfer', createTransfer);
transactionRoutes.post('/update', updateTransaction);
transactionRoutes.post('/delete', deleteTransaction);
