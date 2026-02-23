export interface AuthUserProfile {
  id: string;
  email?: string;
  emailConfirmedAt?: string | null;
  phone?: string | null;
  createdAt?: string | null;
}

export interface AuthSession {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
  tokenType: string;
}

export interface AuthResult {
  user: AuthUserProfile | null;
  session: AuthSession | null;
}
