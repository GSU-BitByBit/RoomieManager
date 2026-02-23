export interface AuthenticatedUser {
  id: string;
  email?: string;
  aud?: string;
  role?: string;
  appMetadata?: Record<string, unknown>;
  userMetadata?: Record<string, unknown>;
}

export interface RequestWithAuthenticatedUser {
  user?: AuthenticatedUser;
}
