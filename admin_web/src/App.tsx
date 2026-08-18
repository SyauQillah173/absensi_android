import { useState } from 'react';
import { AuthProvider, useAuth } from './auth/AuthContext';
import { ExpensePrintPage } from './pages/ExpensePrintPage';
import { ReceiptPrintPage } from './pages/ReceiptPrintPage';
import { AdminLayout, type PageKey } from './layout/AdminLayout';
import { AbsensiPage, type AbsensiNavigationTarget } from './pages/AbsensiPage';
import { AccountPage } from './pages/AccountPage';
import { BukuIndukPage, type BukuIndukSection } from './pages/BukuIndukPage';
import { DataPondokPage } from './pages/DataPondokPage';
import { DashboardPage } from './pages/DashboardPage';
import { FinancePage } from './pages/FinancePage';
import { HakAksesPage } from './pages/HakAksesPage';
import { JadwalPelajaranPage } from './pages/JadwalPelajaranPage';
import { LoginPage } from './pages/LoginPage';
import { MataPelajaranPage } from './pages/MataPelajaranPage';
import { MasterDataPage } from './pages/MasterDataPage';
import { NilaiHafalanPage } from './pages/NilaiHafalanPage';
import { WhatsAppBotPage } from './pages/WhatsAppBotPage';

function AdminShell() {
  const { isAuthenticated, canView } = useAuth();
  const [activePage, setActivePage] = useState<PageKey>('dashboard');
  const [masterSection, setMasterSection] = useState<BukuIndukSection>('ringkas');
  const [absensiTarget, setAbsensiTarget] = useState<(AbsensiNavigationTarget & { key: number }) | undefined>();

  if (!isAuthenticated) {
    return <LoginPage />;
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
    'hak-akses': 'hak_akses'
  };
  const safePage = activePage === 'account' || canView(pagePermissionKeys[activePage] ?? activePage) ? activePage : 'dashboard';

  function navigate(page: PageKey, options?: { masterSection?: BukuIndukSection }) {
    setActivePage(page);
    if (page === 'absensi') {
      setAbsensiTarget(undefined);
    }
    if (page === 'master') {
      setMasterSection(options?.masterSection ?? 'ringkas');
    }
  }

  return (
    <AdminLayout activePage={safePage} activeMasterSection={masterSection} onNavigate={navigate}>
      {safePage === 'dashboard' ? (
        <DashboardPage
          onOpenFinance={() => navigate('keuangan')}
          onOpenAttendance={(target) => {
            setAbsensiTarget({ ...target, key: Date.now() });
            setActivePage('absensi');
          }}
        />
      ) : null}
      {safePage === 'keuangan' ? <FinancePage /> : null}
      {safePage === 'whatsapp' ? <WhatsAppBotPage /> : null}
      {safePage === 'master' ? <BukuIndukPage initialSection={masterSection} onSectionChange={setMasterSection} /> : null}
      {safePage === 'guru' ? <MasterDataPage variant="guru" /> : null}
      {safePage === 'users' ? <MasterDataPage variant="users" /> : null}
      {safePage === 'pondok' ? <DataPondokPage /> : null}
      {safePage === 'absensi' ? <AbsensiPage key={absensiTarget?.key} initialTarget={absensiTarget} /> : null}
      {safePage === 'mapel' ? <MataPelajaranPage /> : null}
      {safePage === 'jadwal' ? <JadwalPelajaranPage /> : null}
      {safePage === 'nilai' ? <NilaiHafalanPage /> : null}
      {safePage === 'hak-akses' ? <HakAksesPage /> : null}
      {safePage === 'account' ? <AccountPage /> : null}
    </AdminLayout>
  );
}

export function App() {
  const path = window.location.pathname;

  if (path.startsWith('/finance/print/')) {
    const id = path.split('/').pop();
    if (id) return <ReceiptPrintPage id={id} />;
  }

  if (path.startsWith('/finance/print-expense/')) {
    const id = path.split('/').pop();
    if (id) return <ExpensePrintPage id={id} />;
  }

  return (
    <AuthProvider>
      <AdminShell />
    </AuthProvider>
  );
}
