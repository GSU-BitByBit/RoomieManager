import type { AuthEmailActionType, AuthSession } from '@/types/api';

export interface ParsedAuthCallback {
  type: AuthEmailActionType | null;
  tokenHash: string | null;
  session: AuthSession | null;
  errorMessage: string | null;
}

function parseParams(raw: string): URLSearchParams {
  if (!raw) {
    return new URLSearchParams();
  }

  const normalized = raw.startsWith('#') || raw.startsWith('?') ? raw.slice(1) : raw;
  return new URLSearchParams(normalized);
}

function normalizeActionType(value: string | null): AuthEmailActionType | null {
  if (
    value === 'email' ||
    value === 'signup' ||
    value === 'recovery' ||
    value === 'magiclink' ||
    value === 'invite' ||
    value === 'email_change'
  ) {
    return value;
  }

  return null;
}

export function parseAuthCallbackUrl(url: URL): ParsedAuthCallback {
  const query = parseParams(url.search);
  const hash = parseParams(url.hash);

  const type = normalizeActionType(hash.get('type') ?? query.get('type'));
  const accessToken = hash.get('access_token') ?? query.get('access_token');
  const refreshToken = hash.get('refresh_token') ?? query.get('refresh_token');
  const tokenType = hash.get('token_type') ?? query.get('token_type') ?? 'bearer';
  const tokenHash = query.get('token_hash') ?? hash.get('token_hash');
  const expiresInRaw = hash.get('expires_in') ?? query.get('expires_in');
  const errorMessage =
    hash.get('error_description') ??
    query.get('error_description') ??
    hash.get('error') ??
    query.get('error');

  const parsedExpiresIn = expiresInRaw ? Number.parseInt(expiresInRaw, 10) : 3600;
  const session =
    accessToken && refreshToken
      ? {
          accessToken,
          refreshToken,
          expiresIn: Number.isFinite(parsedExpiresIn) ? parsedExpiresIn : 3600,
          tokenType,
        }
      : null;

  return {
    type,
    tokenHash,
    session,
    errorMessage,
  };
}

export function resolvePostEmailActionPath(type: AuthEmailActionType | null): string {
  return type === 'recovery' ? '/reset-password' : '/';
}

export function describeEmailAction(type: AuthEmailActionType | null): string {
  if (type === 'recovery') {
    return 'Preparing your password reset...';
  }

  return 'Finalizing your sign-in...';
}
