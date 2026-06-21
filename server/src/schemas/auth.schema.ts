import { z } from 'zod';

const EmailSchema = z.string().trim().email().max(254).transform((value) => value.toLowerCase());

// Sign-in only bounds the length so existing accounts can always authenticate;
// the stored hash is the source of truth. Complexity is enforced at sign-up.
const PasswordSchema = z.string().min(8, 'Use at least 8 characters').max(128);

// New passwords must meet modern complexity rules: length plus character
// variety across uppercase, lowercase, digit, and special characters.
const StrongPasswordSchema = z
  .string()
  .min(8, 'Use at least 8 characters')
  .max(128)
  .regex(/[A-Z]/, 'Include at least one uppercase letter')
  .regex(/[a-z]/, 'Include at least one lowercase letter')
  .regex(/[0-9]/, 'Include at least one number')
  .regex(/[^A-Za-z0-9]/, 'Include at least one special character');

export const SignInSchema = z.object({ email: EmailSchema, password: PasswordSchema }).strict();
export type SignInInput = z.infer<typeof SignInSchema>;

export const SignUpSchema = z.object({
  email: EmailSchema,
  password: StrongPasswordSchema,
  displayName: z.string().trim().min(1).max(100).optional(),
}).strict();
export type SignUpInput = z.infer<typeof SignUpSchema>;

export const EmptyAuthSchema = z.object({}).strict();

export const OAuthProviderSchema = z.enum(['google', 'facebook']);
export type OAuthProvider = z.infer<typeof OAuthProviderSchema>;

export const UnlinkProviderSchema = z.object({ provider: OAuthProviderSchema }).strict();
export type UnlinkProviderInput = z.infer<typeof UnlinkProviderSchema>;
