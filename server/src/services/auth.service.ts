import { authRepository } from '@/repositories/auth.prisma';
import type { AuthRepository, OAuthIdentityData } from '@/repositories/auth.repository';
import type { AuthSessionDTO } from '@/dto/auth.dto';
import type { SignInInput, SignUpInput } from '@/schemas/auth.schema';
import { ConflictError, ForbiddenError } from '@/utils/app-error';
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

  async logout(userId: string): Promise<void> {
    await this.repo.incrementSessionVersion(userId);
    logger.info('auth.logout.succeeded', { userId });
  }

  private assertActive(status: string): void {
    if (status !== 'ACTIVE') throw new ForbiddenError('This account is not active.');
  }
}

export const authService = new AuthService(authRepository);
