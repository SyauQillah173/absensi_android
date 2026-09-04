import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { api, clearSession, readSession, type ApiRecord, type UserSession } from '../services/api';

interface AuthContextValue {
  session: UserSession | null;
  isAuthenticated: boolean;
  isItAdmin: boolean;
  isPengurus: boolean;
  isMainAdmin: boolean;
  isTreasurer: boolean;
  isPmbAdmin: boolean;
  isGuru: boolean;
  isKepalaSekolah: boolean;
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
    const isGuru = session?.role === 'guru';
    const adminType = (session?.admin_type || (session?.role === 'admin' ? 'utama' : '')).toLowerCase();
    
    // Role definitions:
    // 0. Admin IT (Super Admin / Master IT - Bang Nobita): Wewenang tertinggi, bebas buat user IT & kelola Hak Akses
    const isItAdmin = session?.role === 'admin' && (
      ['it', 'superadmin'].includes(adminType) ||
      session?.email === 'syauqillah@absensi.com' ||
      (session?.name && session.name.toLowerCase().includes('syauqillah'))
    );

    // 1. Admin Pengurus (Operasional Yayasan Penuh, tapi dibatasi tidak bisa buat akun IT & tidak ada menu Hak Akses)
    const isPengurus = session?.role === 'admin' && adminType === 'pengurus';

    // 2. Admin Utama Operasional: IT, Pengurus, Superadmin, Utama (Full akses operasional)
    const isMainAdmin = session?.role === 'admin' && (!adminType || ['utama', 'it', 'pengurus', 'superadmin', 'admin'].includes(adminType));
    // 3. Admin Bendahara: Bendahara, Keuangan, Kasir, Bendahara 1 & 2
    const isTreasurer = session?.role === 'admin' && ['bendahara', 'keuangan', 'bendahara_1', 'bendahara_2', 'kasir'].includes(adminType);
    // 4. Kepala Sekolah / Kepala Madrasah (Monitoring Only)
    const isKepalaSekolah = session?.role === 'admin' && ['madrasah', 'absensi', 'kepala_madrasah', 'kepala_sekolah', 'monitoring', 'kepala'].includes(adminType);
    // 5. Admin PMB (Panitia Penerimaan Santri Baru)
    const isPmbAdmin = session?.role === 'admin' && ['pmb', 'admin_pmb'].includes(adminType);
    
    const byKey = (session?.permissions && typeof session.permissions === 'object'
      ? (session.permissions.by_key as ApiRecord | undefined)
      : undefined) ?? {};

    const canView = (menuKey: string) => {
      if (!menuKey) return true;

      // 🔒 Menu Hak Akses & Role User: KHUSUS HANYA untuk Admin IT (Bang Nobita)
      if (menuKey === 'hak_akses' || menuKey === 'hak-akses') {
        return Boolean(isItAdmin);
      }

      if (isMainAdmin) return true;
      if (isGuru) {
        return ['dashboard', 'absensi', 'nilai'].includes(menuKey);
      }
      if (isKepalaSekolah) {
        return ['dashboard', 'absensi'].includes(menuKey);
      }
      if (isTreasurer) {
        return ['dashboard', 'keuangan'].includes(menuKey);
      }
      if (isPmbAdmin) {
        return ['dashboard', 'pmb'].includes(menuKey);
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
      isItAdmin: Boolean(isItAdmin),
      isPengurus: Boolean(isPengurus),
      isMainAdmin,
      isTreasurer,
      isPmbAdmin,
      isGuru,
      isKepalaSekolah,
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
