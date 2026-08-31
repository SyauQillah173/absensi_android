import { useEffect, useState } from 'react';
import { MasterDataPage } from './MasterDataPage';
import { DataPondokPage } from './DataPondokPage';
import { AcademicPage } from './AcademicPage';
import { KelompokBelajarPage } from './KelompokBelajarPage';
import { MasterReferensiPage } from './MasterReferensiPage';

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
  | 'pondok';

interface BukuIndukPageProps {
  initialSection?: BukuIndukSection;
  onSectionChange?: (section: BukuIndukSection) => void;
}

export function BukuIndukPage({ initialSection = 'siswa', onSectionChange }: BukuIndukPageProps) {
  const [section, setSection] = useState<BukuIndukSection>(initialSection);

  useEffect(() => {
    setSection(initialSection);
  }, [initialSection]);

  // Render langsung komponen sesuai section tanpa ada tab/sub-menu ganda di dalam halaman
  if (section === 'alumni') return <MasterDataPage variant="alumni" />;
  if (section === 'guru') return <MasterDataPage variant="guru" />;
  if (section === 'login-admin') return <MasterDataPage variant="login-admin" />;
  if (section === 'login-guru') return <MasterDataPage variant="login-guru" />;
  if (section === 'login-wali') return <MasterDataPage variant="login-wali" />;
  if (section === 'pondok') return <DataPondokPage />;
  if (section === 'akademik') return <AcademicPage />;
  if (section === 'kelompok') return <KelompokBelajarPage />;
  if (section === 'referensi') return <MasterReferensiPage />;
  if (section === 'users') return <MasterDataPage variant="users" />;

  // Default section: Data Siswa/Santri
  return <MasterDataPage variant="siswa" />;
}
