import type { OAuthProvider } from '@/schemas/auth.schema';

export interface AuthAccountRecord {
  id: string;
  email: string;
  passwordHash: string | null;
  status: string;
  sessionVersion: number;
}

export interface OAuthIdentityData {
  provider: OAuthProvider;
  providerId: string;
  email: string;
  displayName?: string;
  avatarUrl?: string;
}

/** Outcome of linking a provider to an already-authenticated account. */
export type LinkProviderResult = 'linked' | 'already_connected' | 'provider_taken' | 'not_found';

/** Outcome of disconnecting a provider from an account. */
export type UnlinkProviderResult = 'unlinked' | 'last_method' | 'not_connected' | 'not_found';

export interface AuthRepository {
  findByEmail(email: string): Promise<AuthAccountRecord | null>;
  createPasswordUser(input: { email: string; passwordHash: string; displayName?: string }): Promise<AuthAccountRecord | null>;
  findOrCreateOAuthUser(input: OAuthIdentityData): Promise<AuthAccountRecord | null>;
  /** Attach a verified provider identity to an existing user (settings flow). */
  linkOAuthProvider(input: { userId: string; provider: OAuthProvider; providerId: string }): Promise<LinkProviderResult>;
  /** Remove a provider from a user, never leaving the account with no sign-in method. */
  unlinkOAuthProvider(userId: string, provider: OAuthProvider): Promise<UnlinkProviderResult>;
  incrementSessionVersion(userId: string): Promise<void>;
}
