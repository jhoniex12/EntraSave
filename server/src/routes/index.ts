import { Router } from 'express';
import { authRoutes } from '@/routes/auth.routes';
import { oauthRoutes } from '@/routes/oauth.routes';
import { accountRoutes } from '@/routes/account.routes';
import { transactionRoutes } from '@/routes/transaction.routes';
import { categoryRoutes } from '@/routes/category.routes';
import { budgetRoutes } from '@/routes/budget.routes';
import { balanceRoutes } from '@/routes/balance.routes';
import { dashboardRoutes } from '@/routes/dashboard.routes';
import { userRoutes } from '@/routes/user.routes';

/**
 * The single `/api` surface (docs/ARCHITECTURE.md §1, §8). Each feature mounts
 * its own thin route module; controllers declare policy, services hold logic.
 * Dependency direction: routes → controllers → services → repositories.
 */
export const apiRouter = Router();

// OAuth is mounted before the credential routes so its `/oauth/...` paths are
// matched first; both share the `/auth` base.
apiRouter.use('/auth/oauth', oauthRoutes);
apiRouter.use('/auth', authRoutes);

apiRouter.use('/accounts', accountRoutes);
apiRouter.use('/transactions', transactionRoutes);
apiRouter.use('/categories', categoryRoutes);
apiRouter.use('/budgets', budgetRoutes);
apiRouter.use('/balances', balanceRoutes);
apiRouter.use('/dashboard', dashboardRoutes);
apiRouter.use('/users', userRoutes);
