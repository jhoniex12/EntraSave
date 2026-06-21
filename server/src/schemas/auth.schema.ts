import { z } from 'zod';

const EmailSchema = z.string().trim().email().max(254).transform((value) => value.toLowerCase());
const PasswordSchema = z.string().min(12, 'Use at least 12 characters').max(128);

export const SignInSchema = z.object({ email: EmailSchema, password: PasswordSchema }).strict();
export type SignInInput = z.infer<typeof SignInSchema>;

export const SignUpSchema = z.object({
  email: EmailSchema,
  password: PasswordSchema,
  displayName: z.string().trim().min(1).max(100).optional(),
}).strict();
export type SignUpInput = z.infer<typeof SignUpSchema>;

export const EmptyAuthSchema = z.object({}).strict();

export const OAuthProviderSchema = z.enum(['google', 'facebook']);
export type OAuthProvider = z.infer<typeof OAuthProviderSchema>;
