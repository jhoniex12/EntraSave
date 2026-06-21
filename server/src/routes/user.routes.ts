import { Router } from 'express';
import { readProfile, updateProfile, updateCurrency } from '@/controllers/user.controller';

/** Users — URL wiring. */
export const userRoutes = Router();

userRoutes.post('/profile', readProfile);
userRoutes.post('/profile/update', updateProfile);
userRoutes.post('/currency', updateCurrency);
