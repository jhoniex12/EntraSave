import { Router } from 'express';
import { dashboardSummary } from '@/controllers/dashboard.controller';

/** Dashboard — URL wiring. */
export const dashboardRoutes = Router();

dashboardRoutes.post('/summary', dashboardSummary);
