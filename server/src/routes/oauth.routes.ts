import { Router } from 'express';
import { startOAuth, oauthCallback } from '@/controllers/oauth.controller';

/** OAuth — URL wiring (start + provider callback). */
export const oauthRoutes = Router();

oauthRoutes.get('/:provider', startOAuth);
oauthRoutes.get('/:provider/callback', oauthCallback);
