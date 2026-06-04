import { createContext, useCallback, useContext, useMemo, useState } from 'react';
import { api, clearSession, readSession, type UserSession } from '../services/api';

interface AuthContextValue {
  session: UserSession | null;
  isAuthenticated: boolean;
  isMainAdmin: boolean;
  isTreasurer: boolean;
  login: (identifier: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<UserSession | null>(() => readSession());

  const login = useCallback(async (identifier: string, password: string) => {
    const nextSession = await api.login(identifier, password);
    setSession(nextSession);
  }, []);

  const logout = useCallback(async () => {
    try {
      if (readSession()?.token) {
        await api.logout();
      }
    } finally {
      clearSession();
      setSession(null);
    }
  }, []);

  const value = useMemo<AuthContextValue>(() => {
    const adminType = (session?.admin_type || 'utama').toLowerCase();
    return {
      session,
      isAuthenticated: Boolean(session?.token),
      isMainAdmin: session?.role === 'admin' && (!adminType || adminType === 'utama'),
      isTreasurer: session?.role === 'admin' && adminType === 'bendahara',
      login,
      logout
    };
  }, [login, logout, session]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used inside AuthProvider');
  }
  return context;
}
