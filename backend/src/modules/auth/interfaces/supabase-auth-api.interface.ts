export interface SupabaseAuthApiUser {
  id: string;
  email?: string | null;
  email_confirmed_at?: string | null;
  phone?: string | null;
  created_at?: string | null;
}

export interface SupabaseAuthApiSession {
  access_token: string;
  refresh_token: string;
  expires_in: number;
  token_type: string;
}

export interface SupabaseAuthApiResponse {
  user: SupabaseAuthApiUser | null;
  session: SupabaseAuthApiSession | null;
}

export interface SupabaseAuthApiTokenResponse {
  user: SupabaseAuthApiUser;
  access_token: string;
  refresh_token: string;
  expires_in: number;
  token_type: string;
}

export interface SupabaseAuthApiError {
  code?: number | string;
  error?: string;
  error_code?: string;
  error_description?: string;
  msg?: string;
  message?: string;
}
