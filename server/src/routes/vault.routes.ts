import { Router } from 'express';
import {
  readVaultState,
  setupVault,
  listVaultItems,
  createVaultItem,
  updateVaultItem,
  deleteVaultItem,
  rekeyVault,
  resetVault,
} from '@/controllers/vault.controller';

/** Password vault — URL wiring. */
export const vaultRoutes = Router();

vaultRoutes.post('/state', readVaultState);
vaultRoutes.post('/setup', setupVault);
vaultRoutes.post('/list', listVaultItems);
vaultRoutes.post('/create', createVaultItem);
vaultRoutes.post('/update', updateVaultItem);
vaultRoutes.post('/delete', deleteVaultItem);
vaultRoutes.post('/rekey', rekeyVault);
vaultRoutes.post('/reset', resetVault);
