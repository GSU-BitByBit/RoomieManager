import { createContext, useContext, useEffect, useState, useCallback } from 'react';
import type { ReactNode } from 'react';
import { auth as authApi, ApiError } from '@/lib/api';
import { resolveIdentityLabel } from '@/lib/identity';
import type { MeResponse } from '@/types/api';

interface User {
  id: string;
  email?: string;
  displayName: string;
}

interface AuthContextType {
  user: User | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string, fullName?: string) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | null>(null);

function readTrustedName(userMetadata?: Record<string, unknown>): string | null {
  const candidates = [
    userMetadata?.full_name,
    userMetadata?.display_name,
    userMetadata?.name,
  ];

  for (const candidate of candidates) {
    if (typeof candidate === 'string' && candidate.trim()) {
      return candidate.trim();
    }
  }

  return null;
}

function buildUserIdentity(
  source: { id: string; email?: string | null; userMetadata?: MeResponse['userMetadata'] },
  explicitName?: string,
): User {
  return {
    id: source.id,
    email: source.email ?? undefined,
    displayName: resolveIdentityLabel({
      displayName: explicitName ?? readTrustedName(source.userMetadata),
      email: source.email,
      userId: source.id,
      fallbackLabel: 'Member',
    }),
  };
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  const checkAuth = useCallback(async () => {
    const token = localStorage.getItem('access_token');
    if (!token) {
      setUser(null);
      setLoading(false);
      return;
    }
    try {
      const me = await authApi.me();
      setUser(buildUserIdentity(me));
    } catch {
      localStorage.removeItem('access_token');
      localStorage.removeItem('refresh_token');
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    checkAuth();
  }, [checkAuth]);

  const login = async (email: string, password: string) => {
    const data = await authApi.login(email, password);
    localStorage.setItem('access_token', data.session.accessToken);
    localStorage.setItem('refresh_token', data.session.refreshToken);
    setUser(buildUserIdentity(data.user));
  };

  const register = async (email: string, password: string, fullName?: string) => {
    const data = await authApi.register(email, password, fullName);
    if (data.session) {
      const session = data.session;
      localStorage.setItem('access_token', session.accessToken);
      localStorage.setItem('refresh_token', session.refreshToken);
      setUser(buildUserIdentity(data.user, fullName));
    }
  };

  const logout = () => {
    localStorage.removeItem('access_token');
    localStorage.removeItem('refresh_token');
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, register, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within AuthProvider');
  return context;
}

export { ApiError };
