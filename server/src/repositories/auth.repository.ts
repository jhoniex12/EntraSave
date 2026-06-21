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

export interface AuthRepository {
  findByEmail(email: string): Promise<AuthAccountRecord | null>;
  createPasswordUser(input: { email: string; passwordHash: string; displayName?: string }): Promise<AuthAccountRecord | null>;
  findOrCreateOAuthUser(input: OAuthIdentityData): Promise<AuthAccountRecord | null>;
  incrementSessionVersion(userId: string): Promise<void>;
}
