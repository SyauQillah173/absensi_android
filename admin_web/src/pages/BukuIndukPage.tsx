import { ArrowLeft, BookOpen, Building2, CalendarDays, GraduationCap, ShieldCheck, UserRoundCheck, UsersRound } from 'lucide-react';
import { useEffect, useState } from 'react';
import { SegmentedTabs } from '../components/SegmentedTabs';
import { MasterDataPage } from './MasterDataPage';
import { DataPondokPage } from './DataPondokPage';
import { AcademicPage } from './AcademicPage';
import { KelompokBelajarPage } from './KelompokBelajarPage';
import { MasterReferensiPage } from './MasterReferensiPage';

export type BukuIndukSection = 'ringkas' | 'siswa' | 'alumni' | 'guru' | 'users' | 'referensi' | 'login-admin' | 'login-guru' | 'login-wali' | 'akademik' | 'kelompok' | 'pondok';

const sections = [
  { id: 'siswa', label: 'Data Siswa/Santri' },
  { id: 'alumni', label: 'Data Santri Alumni' },
  { id: 'guru', label: 'Data Guru' },
  { id: 'users', label: 'User Login' },
  { id: 'referensi', label: 'Data Referensi' },
  { id: 'akademik', label: 'Akademik' },
  { id: 'kelompok', label: 'Kelompok' },
  { id: 'pondok', label: 'Data Pondok' }
];

const menuCards = [
  {
    id: 'referensi',
    title: 'Data Referensi',
    subtitle: 'Opsi Kabupaten, Desa, Negara, Tempat Lahir, dll.',
    icon: BookOpen,
    tone: 'text-[#E8590C] bg-[#FFF0E8]'
  },
  {
    id: 'siswa',
    title: 'Data Siswa/Santri',
    subtitle: 'NIS, NISN, wali, status, kelas, dan data utama santri aktif.',
    icon: UsersRound,
    tone: 'text-[#2E86DE] bg-[#E8F3FF]'
  },
  {
    id: 'alumni',
    title: 'Data Santri Alumni',
    subtitle: 'Daftar santri yang telah lulus madin, arsip kelulusan & alumni.',
    icon: GraduationCap,
    tone: 'text-[#6C5CE7] bg-[#F0ECFF]'
  },
  {
    id: 'guru',
    title: 'Data Guru',
    subtitle: 'Akun guru, status aktif, dan data pengajar.',
    icon: GraduationCap,
    tone: 'text-[#138F81] bg-[#E8F7F3]'
  },
  {
    id: 'users',
    title: 'User Login',
    subtitle: 'Akun dipisah rapi: Admin, Guru, dan Wali.',
    icon: UsersRound,
    tone: 'text-[#E8590C] bg-[#FFF0E8]'
  },
  {
    id: 'akademik',
    title: 'Setting Akademik',
    subtitle: 'Tahun ajaran, semester aktif, dan sinkronisasi periode.',
    icon: CalendarDays,
    tone: 'text-[#138F81] bg-[#E8F7F3]'
  },
  {
    id: 'kelompok',
    title: 'Kelompok Belajar',
    subtitle: 'Kelola kelompok sifir/kelas dan anggota belajar.',
    icon: BookOpen,
    tone: 'text-[#6C5CE7] bg-[#F0ECFF]'
  },
  {
    id: 'pondok',
    title: 'Data Pondok',
    subtitle: 'Komplek, kamar, santri pondok, dan akses absensi sholat.',
    icon: Building2,
    tone: 'text-[#138F81] bg-[#E8F7F3]'
  }
];

const userLoginCards = [
  {
    id: 'login-admin',
    title: 'Data Login Admin',
    subtitle: 'Admin utama, bendahara, pondok, absensi, akademik, dan admin lain.',
    icon: ShieldCheck,
    tone: 'text-[#E8590C] bg-[#FFF0E8]'
  },
  {
    id: 'login-guru',
    title: 'Data Login Guru',
    subtitle: 'Akun guru penginput absensi, nilai, dan akses sesuai permission.',
    icon: GraduationCap,
    tone: 'text-[#2E86DE] bg-[#E8F3FF]'
  },
  {
    id: 'login-wali',
    title: 'Data Login Wali',
    subtitle: 'Akun wali/orang tua yang memantau anak dan tagihan.',
    icon: UserRoundCheck,
    tone: 'text-[#138F81] bg-[#E8F7F3]'
  }
];

const parentSection: Partial<Record<BukuIndukSection, BukuIndukSection>> = {
  siswa: 'ringkas',
  alumni: 'ringkas',
  guru: 'ringkas',
  users: 'ringkas',
  akademik: 'ringkas',
  kelompok: 'ringkas',
  pondok: 'ringkas',
  'login-admin': 'users',
  'login-guru': 'users',
  'login-wali': 'users'
};

interface BukuIndukPageProps {
  initialSection?: BukuIndukSection;
  onSectionChange?: (section: BukuIndukSection) => void;
}

export function BukuIndukPage({ initialSection = 'ringkas', onSectionChange }: BukuIndukPageProps) {
  const [section, setSection] = useState<BukuIndukSection>(initialSection);

  useEffect(() => {
    setSection(initialSection);
  }, [initialSection]);

  function selectSection(next: BukuIndukSection) {
    setSection(next);
    onSectionChange?.(next);
  }

  function goBack() {
    selectSection(parentSection[section] ?? 'ringkas');
  }

  const backHeader = (
    <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
      <button
        className="q-soft-action inline-flex min-h-11 items-center gap-2 rounded-2xl bg-white px-4 text-sm font-extrabold text-[#138F81]"
        onClick={goBack}
        type="button"
      >
        <ArrowLeft size={18} />
        Kembali
      </button>
    </div>
  );

  if (section === 'siswa') return <>{backHeader}<MasterDataPage variant="siswa" /></>;
  if (section === 'alumni') return <>{backHeader}<MasterDataPage variant="alumni" /></>;
  if (section === 'guru') return <>{backHeader}<MasterDataPage variant="guru" /></>;
  if (section === 'login-admin') return <>{backHeader}<MasterDataPage variant="login-admin" /></>;
  if (section === 'login-guru') return <>{backHeader}<MasterDataPage variant="login-guru" /></>;
  if (section === 'login-wali') return <>{backHeader}<MasterDataPage variant="login-wali" /></>;
  if (section === 'pondok') return <>{backHeader}<DataPondokPage /></>;
  if (section === 'akademik') return <>{backHeader}<AcademicPage /></>;
  if (section === 'kelompok') return <>{backHeader}<KelompokBelajarPage /></>;
  if (section === 'referensi') return <>{backHeader}<MasterReferensiPage /></>;

  return (
    <div className="space-y-6">
      <section className="q-page-heading">
        <p className="text-sm font-bold text-[#636E72]">Buku Induk</p>
        <h1 className="text-3xl font-extrabold text-[#2D3436]">Master Data Qomaruddin</h1>
        <p className="text-sm font-semibold text-[#636E72]">Dibuat seperti grup Android: satu menu besar, isi datanya dipisah rapi di dalamnya.</p>
      </section>

      <SegmentedTabs tabs={sections} active={section === 'ringkas' ? '' : section} onChange={(id) => selectSection(id as BukuIndukSection)} />

      {section === 'ringkas' ? (
        <section className="q-master-card-grid grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {menuCards.map((item) => {
            const Icon = item.icon;
            return (
              <button
                key={item.id}
                className="q-card q-master-card flex min-h-36 items-center gap-5 p-5 text-left transition hover:-translate-y-1 hover:shadow-2xl"
                onClick={() => selectSection(item.id as BukuIndukSection)}
                type="button"
              >
                <span className={`grid h-16 w-16 shrink-0 place-items-center rounded-3xl ${item.tone}`}>
                  <Icon size={28} />
                </span>
                <span className="min-w-0">
                  <span className="block text-xl font-extrabold text-[#2D3436]">{item.title}</span>
                  <span className="mt-1 block text-sm font-semibold leading-relaxed text-[#636E72]">{item.subtitle}</span>
                </span>
              </button>
            );
          })}
        </section>
      ) : section === 'users' ? (
        <section className="q-master-card-grid grid gap-4 md:grid-cols-3">
          {userLoginCards.map((item) => {
            const Icon = item.icon;
            return (
              <button
                key={item.id}
                className="q-card q-master-card flex min-h-36 items-center gap-5 p-5 text-left transition hover:-translate-y-1 hover:shadow-2xl"
                onClick={() => selectSection(item.id as BukuIndukSection)}
                type="button"
              >
                <span className={`grid h-16 w-16 shrink-0 place-items-center rounded-3xl ${item.tone}`}>
                  <Icon size={28} />
                </span>
                <span className="min-w-0">
                  <span className="block text-xl font-extrabold text-[#2D3436]">{item.title}</span>
                  <span className="mt-1 block text-sm font-semibold leading-relaxed text-[#636E72]">{item.subtitle}</span>
                </span>
              </button>
            );
          })}
        </section>
      ) : null}
    </div>
  );
}
