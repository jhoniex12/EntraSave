export interface UserProfileDTO {
  displayName: string | null;
  email: string;
  avatarUrl: string | null;
  hasPassword: boolean;
  googleLinked: boolean;
  facebookLinked: boolean;
}
