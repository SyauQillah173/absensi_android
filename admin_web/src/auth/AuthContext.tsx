import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { api, clearSession, readSession, type ApiRecord, type UserSession } from '../services/api';

interface AuthContextValue {
  session: UserSession | null;
  isAuthenticated: boolean;
  isMainAdmin: boolean;
  isTreasurer: boolean;
  canView: (menuKey: string) => boolean;
  refreshProfile: () => Promise<UserSession | null>;
  login: (identifier: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<UserSession | null>(() => readSession());

  useEffect(() => {
    const handleExpired = () => {
      clearSession();
      setSession(null);
    };
    window.addEventListener('qomaruddin_auth_expired', handleExpired);
    return () => window.removeEventListener('qomaruddin_auth_expired', handleExpired);
  }, []);

  const login = useCallback(async (identifier: string, password: string) => {
    const nextSession = await api.login(identifier, password);
    setSession(nextSession);
  }, []);

  const refreshProfile = useCallback(async () => {
    if (!readSession()?.token) return null;
    const nextSession = await api.refreshProfile();
    setSession(nextSession);
    return nextSession;
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
    const isMainAdmin = session?.role === 'admin' && (!adminType || ['utama', 'it', 'pengurus'].includes(adminType));
    const isTreasurer = session?.role === 'admin' && ['bendahara', 'keuangan', 'bendahara_1', 'bendahara_2'].includes(adminType);
    const isMadrasah = session?.role === 'admin' && ['madrasah', 'absensi', 'kepala_madrasah'].includes(adminType);
    const byKey = (session?.permissions && typeof session.permissions === 'object'
      ? (session.permissions.by_key as ApiRecord | undefined)
      : undefined) ?? {};

    const canView = (menuKey: string) => {
      if (!menuKey) return true;
      if (isMainAdmin) return true;
      if (isMadrasah) {
        return ['dashboard', 'absensi', 'nilai', 'account'].includes(menuKey);
      }
      if (isTreasurer) {
        return ['dashboard', 'keuangan', 'account'].includes(menuKey);
      }
      const permission = byKey[menuKey];
      if (permission && typeof permission === 'object') {
        const row = permission as ApiRecord;
        const enabled = row.is_enabled === true || row.is_enabled === 1 || row.is_enabled === '1';
        const view = row.can_view === true || row.can_view === 1 || row.can_view === '1';
        return enabled && view;
      }
      return session?.role === 'admin';
    };

    return {
      session,
      isAuthenticated: Boolean(session?.token),
      isMainAdmin,
      isTreasurer,
      canView,
      refreshProfile,
      login,
      logout
    };
  }, [login, logout, refreshProfile, session]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used inside AuthProvider');
  }
  return context;
}
