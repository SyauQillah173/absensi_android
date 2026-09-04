import { lazy, Suspense, useState } from 'react';
import { AuthProvider, useAuth } from './auth/AuthContext';
import { AdminLayout, type PageKey } from './layout/AdminLayout';
import type { AbsensiNavigationTarget, AbsensiTab } from './pages/AbsensiPage';
import type { BukuIndukSection } from './pages/BukuIndukPage';

// Lazy-loaded page components for ultra-fast initial bundle loading
const LoginPage = lazy(() => import('./pages/LoginPage').then((m) => ({ default: m.LoginPage })));
const DashboardPage = lazy(() => import('./pages/DashboardPage').then((m) => ({ default: m.DashboardPage })));
const FinancePage = lazy(() => import('./pages/FinancePage').then((m) => ({ default: m.FinancePage })));
const BukuIndukPage = lazy(() => import('./pages/BukuIndukPage').then((m) => ({ default: m.BukuIndukPage })));
const MasterDataPage = lazy(() => import('./pages/MasterDataPage').then((m) => ({ default: m.MasterDataPage })));
const DataPondokPage = lazy(() => import('./pages/DataPondokPage').then((m) => ({ default: m.DataPondokPage })));
const AbsensiPage = lazy(() => import('./pages/AbsensiPage').then((m) => ({ default: m.AbsensiPage })));
const MataPelajaranPage = lazy(() => import('./pages/MataPelajaranPage').then((m) => ({ default: m.MataPelajaranPage })));
const JadwalPelajaranPage = lazy(() => import('./pages/JadwalPelajaranPage').then((m) => ({ default: m.JadwalPelajaranPage })));
const NilaiHafalanPage = lazy(() => import('./pages/NilaiHafalanPage').then((m) => ({ default: m.NilaiHafalanPage })));
const HakAksesPage = lazy(() => import('./pages/HakAksesPage').then((m) => ({ default: m.HakAksesPage })));
const WhatsAppBotPage = lazy(() => import('./pages/WhatsAppBotPage').then((m) => ({ default: m.WhatsAppBotPage })));
const AccountPage = lazy(() => import('./pages/AccountPage').then((m) => ({ default: m.AccountPage })));
const ReceiptPrintPage = lazy(() => import('./pages/ReceiptPrintPage').then((m) => ({ default: m.ReceiptPrintPage })));
const ExpensePrintPage = lazy(() => import('./pages/ExpensePrintPage').then((m) => ({ default: m.ExpensePrintPage })));
const WaliPortalPage = lazy(() => import('./pages/WaliPortalPage').then((m) => ({ default: m.WaliPortalPage })));
const PmbAdminPage = lazy(() => import('./pages/PmbAdminPage').then((m) => ({ default: m.PmbAdminPage })));
const PublicPmbLandingPage = lazy(() => import('./pages/PublicPmbLandingPage').then((m) => ({ default: m.PublicPmbLandingPage })));

function PageLoader() {
  return (
    <div className="flex min-h-[50vh] w-full flex-col items-center justify-center gap-3">
      <div className="h-10 w-10 animate-spin rounded-full border-4 border-[#138F81]/20 border-t-[#138F81]" />
      <span className="text-xs font-bold text-[#636E72] animate-pulse">Memuat halaman...</span>
    </div>
  );
}

function AdminShell() {
  const { isAuthenticated, canView, session, isItAdmin, isPmbAdmin } = useAuth();
  const [publicView, setPublicView] = useState<'login' | 'pmb'>(() => {
    const p = window.location.pathname.toLowerCase();
    const s = window.location.search.toLowerCase();
    const h = window.location.hash.toLowerCase();
    return (
      p.startsWith('/pmb') ||
      p.startsWith('/santri-baru') ||
      p.startsWith('/profil') ||
      s.includes('pmb') ||
      s.includes('santri-baru') ||
      h.includes('pmb')
    ) ? 'pmb' : 'login';
  });

  const handleSwitchPublicView = (view: 'login' | 'pmb') => {
    setPublicView(view);
    try {
      const url = new URL(window.location.href);
      if (view === 'pmb') {
        url.searchParams.set('pmb', '1');
      } else {
        url.searchParams.delete('pmb');
      }
      window.history.replaceState({}, '', url.toString());
    } catch {
      // safe fallback
    }
  };

  const [activePage, setActivePage] = useState<PageKey>(() => {
    if (session?.role === 'admin' && String(session?.admin_type || '').toLowerCase() === 'pmb') {
      return 'pmb';
    }
    return 'dashboard';
  });
  const [masterSection, setMasterSection] = useState<BukuIndukSection>('siswa');
  const [financeTab, setFinanceTab] = useState<string>('today');
  const [absensiTab, setAbsensiTab] = useState<AbsensiTab>('log-realtime');
  const [pmbTab, setPmbTab] = useState<string>('dashboard');
  const [absensiTarget, setAbsensiTarget] = useState<(AbsensiNavigationTarget & { key: number }) | undefined>();

  if (!isAuthenticated) {
    return (
      <Suspense fallback={<PageLoader />}>
        {publicView === 'pmb' ? (
          <PublicPmbLandingPage onOpenLogin={() => handleSwitchPublicView('login')} />
        ) : (
          <LoginPage onOpenPmb={() => handleSwitchPublicView('pmb')} />
        )}
      </Suspense>
    );
  }

  // Khusus role Wali Santri, tampilkan langsung Portal Wali yang modern & realtime
  if (session?.role === 'wali') {
    return (
      <Suspense fallback={<PageLoader />}>
        <WaliPortalPage />
      </Suspense>
    );
  }

  const pagePermissionKeys: Partial<Record<PageKey, string>> = {
    dashboard: 'dashboard',
    absensi: 'absensi',
    master: 'buku_induk',
    guru: 'buku_induk',
    users: 'buku_induk',
    pondok: 'buku_induk',
    mapel: 'mata_pelajaran',
    jadwal: 'mata_pelajaran',
    keuangan: 'keuangan',
    whatsapp: 'whatsapp_bot',
    nilai: 'nilai',
    'hak-akses': 'hak_akses',
    pmb: 'pmb',
  };
  const safePage = activePage === 'account' || canView(pagePermissionKeys[activePage] ?? activePage) ? activePage : 'dashboard';

  function navigate(page: PageKey, options?: { masterSection?: BukuIndukSection; financeTab?: string; absensiTab?: AbsensiTab; pmbTab?: string }) {
    setActivePage(page);
    if (page === 'absensi') {
      setAbsensiTarget(undefined);
      if (options?.absensiTab) {
        setAbsensiTab(options.absensiTab);
      }
    }
    if (page === 'master') {
      setMasterSection(options?.masterSection ?? 'siswa');
    }
    if (page === 'keuangan') {
      setFinanceTab(options?.financeTab ?? 'today');
    }
    if (page === 'pmb') {
      setPmbTab(options?.pmbTab ?? 'dashboard');
    }
  }

  return (
    <AdminLayout
      activePage={safePage}
      activeMasterSection={masterSection}
      activeFinanceTab={financeTab}
      activeAbsensiTab={absensiTab}
      activePmbTab={pmbTab}
      onNavigate={navigate}
    >
      <Suspense fallback={<PageLoader />}>
        {safePage === 'dashboard' ? (
          <DashboardPage
            onOpenFinance={() => navigate('keuangan', { financeTab: 'today' })}
            onNavigateFinance={(tab) => navigate('keuangan', { financeTab: tab })}
            onOpenAttendance={(target) => {
              setAbsensiTarget({ ...target, key: Date.now() });
              setAbsensiTab(target.tab);
              setActivePage('absensi');
            }}
          />
        ) : null}

        {safePage === 'keuangan' ? (
          <FinancePage initialTab={financeTab} onTabChange={setFinanceTab} />
        ) : null}
        {safePage === 'whatsapp' ? <WhatsAppBotPage /> : null}
        {safePage === 'master' ? <BukuIndukPage initialSection={masterSection} onSectionChange={setMasterSection} /> : null}
        {safePage === 'guru' ? <MasterDataPage variant="guru" /> : null}
        {safePage === 'users' ? <MasterDataPage variant="users" /> : null}
        {safePage === 'pondok' ? <DataPondokPage /> : null}
        {safePage === 'absensi' ? (
          <AbsensiPage
            key={`${absensiTarget?.key ?? ''}-${absensiTab}`}
            initialTab={absensiTab}
            initialTarget={absensiTarget}
            onTabChange={setAbsensiTab}
          />
        ) : null}
        {safePage === 'mapel' ? <MataPelajaranPage /> : null}
        {safePage === 'jadwal' ? <JadwalPelajaranPage /> : null}
        {safePage === 'nilai' ? <NilaiHafalanPage /> : null}
        {safePage === 'hak-akses' && isItAdmin ? <HakAksesPage /> : null}
        {safePage === 'account' ? <AccountPage /> : null}
        {safePage === 'pmb' ? <PmbAdminPage initialTab={pmbTab} onTabChange={setPmbTab} /> : null}
      </Suspense>
    </AdminLayout>
  );
}

export function App() {
  const path = window.location.pathname;

  if (path.startsWith('/finance/print/')) {
    const id = path.split('/').pop();
    if (id) {
      return (
        <Suspense fallback={<PageLoader />}>
          <ReceiptPrintPage id={id} />
        </Suspense>
      );
    }
  }

  if (path.startsWith('/finance/print-expense/')) {
    const id = path.split('/').pop();
    if (id) {
      return (
        <Suspense fallback={<PageLoader />}>
          <ExpensePrintPage id={id} />
        </Suspense>
      );
    }
  }

  return (
    <AuthProvider>
      <AdminShell />
    </AuthProvider>
  );
}
