import { Router } from 'express';
import { startOAuth, startOAuthLink, oauthCallback } from '@/controllers/oauth.controller';

/** OAuth — URL wiring (start + provider callback + authenticated link start). */
export const oauthRoutes = Router();

oauthRoutes.get('/:provider', startOAuth);
oauthRoutes.get('/:provider/link', startOAuthLink);
oauthRoutes.get('/:provider/callback', oauthCallback);
