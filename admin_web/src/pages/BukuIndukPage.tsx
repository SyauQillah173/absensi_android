import { lazy, Suspense, useEffect, useState } from 'react';
import { MasterDataPage } from './MasterDataPage';

const DataPondokPage = lazy(() => import('./DataPondokPage').then((m) => ({ default: m.DataPondokPage })));
const AcademicPage = lazy(() => import('./AcademicPage').then((m) => ({ default: m.AcademicPage })));
const KelompokBelajarPage = lazy(() => import('./KelompokBelajarPage').then((m) => ({ default: m.KelompokBelajarPage })));
const MasterReferensiPage = lazy(() => import('./MasterReferensiPage').then((m) => ({ default: m.MasterReferensiPage })));
const MasterKelasPage = lazy(() => import('./MasterKelasPage').then((m) => ({ default: m.MasterKelasPage })));

export type BukuIndukSection =
  | 'ringkas'
  | 'siswa'
  | 'alumni'
  | 'guru'
  | 'users'
  | 'referensi'
  | 'login-admin'
  | 'login-guru'
  | 'login-wali'
  | 'akademik'
  | 'kelompok'
  | 'pondok'
  | 'kelas';

interface BukuIndukPageProps {
  initialSection?: BukuIndukSection;
  onSectionChange?: (section: BukuIndukSection) => void;
}

export function BukuIndukPage({ initialSection = 'siswa', onSectionChange }: BukuIndukPageProps) {
  const [section, setSection] = useState<BukuIndukSection>(initialSection);

  useEffect(() => {
    setSection(initialSection);
  }, [initialSection]);

  const fallback = (
    <div className="flex min-h-[30vh] w-full items-center justify-center">
      <div className="h-8 w-8 animate-spin rounded-full border-3 border-[#138F81]/20 border-t-[#138F81]" />
    </div>
  );

  // Render langsung komponen sesuai section tanpa ada tab/sub-menu ganda di dalam halaman
  if (section === 'kelas') return <Suspense fallback={fallback}><MasterKelasPage /></Suspense>;
  if (section === 'alumni') return <MasterDataPage variant="alumni" />;
  if (section === 'guru') return <MasterDataPage variant="guru" />;
  if (section === 'login-admin') return <MasterDataPage variant="login-admin" />;
  if (section === 'login-guru') return <MasterDataPage variant="login-guru" />;
  if (section === 'login-wali') return <MasterDataPage variant="login-wali" />;
  if (section === 'pondok') return <Suspense fallback={fallback}><DataPondokPage /></Suspense>;
  if (section === 'akademik') return <Suspense fallback={fallback}><AcademicPage /></Suspense>;
  if (section === 'kelompok') return <Suspense fallback={fallback}><KelompokBelajarPage /></Suspense>;
  if (section === 'referensi') return <Suspense fallback={fallback}><MasterReferensiPage /></Suspense>;
  if (section === 'users') return <MasterDataPage variant="users" />;

  // Default section: Data Siswa/Santri
  return <MasterDataPage variant="siswa" />;
}
