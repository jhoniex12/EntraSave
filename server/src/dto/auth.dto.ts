/** Internal authentication result; never includes credentials or provider tokens. */
export interface AuthSessionDTO {
  userId: string;
  sessionVersion: number;
}

export interface AuthActionDTO {
  authenticated: true;
}
