/** Users repository interface for authenticated profile settings. */
export interface UserProfileRecord {
  displayName: string | null;
  email: string;
  avatarUrl: string | null;
  passwordHash: string | null;
  googleId: string | null;
  facebookId: string | null;
}

export interface UserRepository {
  getProfile(userId: string): Promise<UserProfileRecord | null>;
  updateDisplayName(userId: string, displayName: string): Promise<number>;
  updateBaseCurrency(userId: string, currency: string): Promise<void>;
}
