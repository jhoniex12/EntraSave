import { Router } from 'express';
import { setStartingBalance, resetStartingBalance } from '@/controllers/balance.controller';

/** Monthly balance — URL wiring. */
export const balanceRoutes = Router();

balanceRoutes.post('/set', setStartingBalance);
balanceRoutes.post('/reset', resetStartingBalance);
