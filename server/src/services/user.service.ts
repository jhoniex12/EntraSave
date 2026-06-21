import type { AuthContext } from '@/utils/auth-context';
import { userRepository } from '@/repositories/user.prisma';
import type { UserRepository } from '@/repositories/user.repository';
import type { UpdateBaseCurrencyInput, UpdateProfileInput } from '@/schemas/user.schema';
import type { UserProfileDTO } from '@/dto/user.dto';
import { NotFoundError } from '@/utils/app-error';

/**
 * Users — service layer for authenticated profile settings.
 */
export class UserService {
  constructor(private readonly repo: UserRepository) {}

  async getProfile(ctx: AuthContext): Promise<UserProfileDTO> {
    const profile = await this.repo.getProfile(ctx.userId);
    if (!profile) throw new NotFoundError('User profile not found');
    return {
      displayName: profile.displayName,
      email: profile.email,
      avatarUrl: profile.avatarUrl,
      hasPassword: Boolean(profile.passwordHash),
      googleLinked: Boolean(profile.googleId),
      facebookLinked: Boolean(profile.facebookId),
    };
  }

  async updateProfile(
    ctx: AuthContext,
    input: UpdateProfileInput,
  ): Promise<{ displayName: string }> {
    const count = await this.repo.updateDisplayName(ctx.userId, input.displayName);
    if (count === 0) throw new NotFoundError('User profile not found');
    return { displayName: input.displayName };
  }

  async updateBaseCurrency(
    ctx: AuthContext,
    input: UpdateBaseCurrencyInput,
  ): Promise<{ currency: string }> {
    await this.repo.updateBaseCurrency(ctx.userId, input.currency);
    return { currency: input.currency };
  }
}

export const userService = new UserService(userRepository);
