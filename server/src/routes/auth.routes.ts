import { Router } from 'express';
import { signIn, signUp, logout, unlinkProvider, me, providers } from '@/controllers/auth.controller';

/** Auth — URL wiring (credentials + session bootstrap). */
export const authRoutes = Router();

authRoutes.post('/signin', signIn);
authRoutes.post('/signup', signUp);
authRoutes.post('/logout', logout);
authRoutes.post('/unlink', unlinkProvider);
authRoutes.get('/me', me);
authRoutes.get('/providers', providers);
