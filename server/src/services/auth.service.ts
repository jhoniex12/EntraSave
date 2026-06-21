import { authRepository } from '@/repositories/auth.prisma';
import type { AuthRepository, OAuthIdentityData } from '@/repositories/auth.repository';
import type { AuthSessionDTO } from '@/dto/auth.dto';
import type { OAuthProvider, SignInInput, SignUpInput } from '@/schemas/auth.schema';
import { ConflictError, ForbiddenError, NotFoundError } from '@/utils/app-error';
import { hashPassword, verifyPassword } from '@/utils/password';
import { logger } from '@/utils/logger';

const dummyHash = hashPassword('not-a-real-user-password');

export class AuthService {
  constructor(private readonly repo: AuthRepository) {}

  async signIn(input: SignInInput): Promise<AuthSessionDTO> {
    const account = await this.repo.findByEmail(input.email);
    const encodedHash = account?.passwordHash ?? await dummyHash;
    const valid = await verifyPassword(input.password, encodedHash);
    if (!account || !account.passwordHash || !valid) {
      throw new ForbiddenError('Invalid email or password.');
    }
    this.assertActive(account.status);
    logger.info('auth.password.succeeded', { userId: account.id });
    return { userId: account.id, sessionVersion: account.sessionVersion };
  }

  async signUp(input: SignUpInput): Promise<AuthSessionDTO> {
    const passwordHash = await hashPassword(input.password);
    const account = await this.repo.createPasswordUser({
      email: input.email,
      passwordHash,
      displayName: input.displayName,
    });
    if (!account) throw new ConflictError('An account with this email already exists.');
    logger.info('auth.signup.succeeded', { userId: account.id });
    return { userId: account.id, sessionVersion: account.sessionVersion };
  }

  async signInWithOAuth(input: OAuthIdentityData): Promise<AuthSessionDTO> {
    const account = await this.repo.findOrCreateOAuthUser({
      ...input,
      email: input.email.trim().toLowerCase(),
    });
    if (!account) throw new ConflictError('This identity is already linked to another account.');
    this.assertActive(account.status);
    logger.info('auth.oauth.succeeded', { userId: account.id, provider: input.provider });
    return { userId: account.id, sessionVersion: account.sessionVersion };
  }

  /**
   * Attach a verified provider identity to the already-authenticated user
   * (settings "Connect" flow). This is the safe counterpart to the sign-in
   * guard that refuses to auto-claim password accounts: here the user has proven
   * ownership of the account via their session before linking.
   */
  async linkOAuthIdentity(userId: string, identity: OAuthIdentityData): Promise<void> {
    const result = await this.repo.linkOAuthProvider({
      userId,
      provider: identity.provider,
      providerId: identity.providerId,
    });
    const label = providerLabel(identity.provider);
    switch (result) {
      case 'linked':
        logger.info('auth.oauth.linked', { userId, provider: identity.provider });
        return;
      case 'provider_taken':
        throw new ConflictError(`This ${label} account is already linked to another EntraSave account.`);
      case 'already_connected':
        throw new ConflictError(`A different ${label} account is already connected. Disconnect it first.`);
      case 'not_found':
        throw new NotFoundError('User profile not found.');
    }
  }

  async unlinkProvider(userId: string, provider: OAuthProvider): Promise<void> {
    const result = await this.repo.unlinkOAuthProvider(userId, provider);
    switch (result) {
      case 'unlinked':
        logger.info('auth.oauth.unlinked', { userId, provider });
        return;
      case 'last_method':
        throw new ConflictError('You can’t remove your only sign-in method. Set a password or connect another provider first.');
      case 'not_connected':
        throw new ConflictError(`${providerLabel(provider)} is not connected to your account.`);
      case 'not_found':
        throw new NotFoundError('User profile not found.');
    }
  }

  async logout(userId: string): Promise<void> {
    await this.repo.incrementSessionVersion(userId);
    logger.info('auth.logout.succeeded', { userId });
  }

  private assertActive(status: string): void {
    if (status !== 'ACTIVE') throw new ForbiddenError('This account is not active.');
  }
}

function providerLabel(provider: OAuthProvider): string {
  return provider === 'google' ? 'Google' : 'Facebook';
}

export const authService = new AuthService(authRepository);
