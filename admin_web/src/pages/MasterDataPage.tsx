import { Building2, Download, FileSpreadsheet, GraduationCap, RefreshCw, Search, Upload, UsersRound } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { DataTable, type DataColumn } from '../components/DataTable';
import { SearchInput } from '../components/SearchInput';
import { StatCard } from '../components/StatCard';
import { StatusBadge } from '../components/StatusBadge';
import { api, type ApiRecord, type ImportResult } from '../services/api';
import { downloadImportTemplate, exportRowsExcel, parseImportFile, type ImportTemplateType } from '../utils/importTemplates';

export type MasterVariant = 'siswa' | 'guru' | 'users' | 'login-admin' | 'login-guru' | 'login-wali' | 'pondok';

interface MasterDataPageProps {
  variant: MasterVariant;
}

const config = {
  siswa: {
    title: 'Buku Induk - Data Siswa',
    subtitle: 'Daftar siswa dari backend yang sama dengan Android.',
    search: 'Cari nama / NIS / NISN / kelas',
    icon: UsersRound
  },
  guru: {
    title: 'Data Guru',
    subtitle: 'Guru dan akun pengajar aktif.',
    search: 'Cari nama / email / NIS',
    icon: GraduationCap
  },
  users: {
    title: 'User Login / Data Admin',
    subtitle: 'Akun admin, guru, dan wali.',
    search: 'Cari nama / email / role',
    icon: UsersRound
  },
  'login-admin': {
    title: 'Data Login Admin',
    subtitle: 'Akun Admin Utama, Bendahara, Pondok, Absensi, dan admin lain.',
    search: 'Cari nama / email / tipe admin',
    icon: UsersRound
  },
  'login-guru': {
    title: 'Data Login Guru',
    subtitle: 'Akun guru yang dipakai login ke aplikasi dan web sesuai akses.',
    search: 'Cari nama / email / kode guru',
    icon: GraduationCap
  },
  'login-wali': {
    title: 'Data Login Wali',
    subtitle: 'Akun wali/orang tua yang hanya memantau data anak.',
    search: 'Cari nama / email / no HP',
    icon: UsersRound
  },
  pondok: {
    title: 'Data Pondok',
    subtitle: 'Komplek, kamar, dan santri pondok.',
    search: 'Cari santri / komplek / kamar',
    icon: Building2
  }
};

function text(value: unknown, fallback = '-'): string {
  const result = String(value ?? '').trim();
  return result || fallback;
}

function record(value: unknown): ApiRecord {
  return value && typeof value === 'object' && !Array.isArray(value) ? (value as ApiRecord) : {};
}

function countStatus(rows: ApiRecord[], status: string): number {
  return rows.filter((row) => String(row.status ?? '').toLowerCase() === status.toLowerCase()).length;
}

export function MasterDataPage({ variant }: MasterDataPageProps) {
  const [rows, setRows] = useState<ApiRecord[]>([]);
  const [search, setSearch] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isImporting, setIsImporting] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const current = config[variant];
  const Icon = current.icon;
  const importConfig = getImportConfig(variant);

  async function load() {
    setIsLoading(true);
    setError('');
    setNotice('');
    try {
      let result;
      if (variant === 'siswa') {
        result = await api.siswa({ with_wali: 1 });
      } else if (variant === 'guru' || variant === 'login-guru') {
        result = await api.users({ role: 'guru' });
      } else if (variant === 'login-admin') {
        result = await api.users({ role: 'admin' });
      } else if (variant === 'login-wali') {
        result = await api.users({ role: 'wali' });
      } else if (variant === 'users') {
        result = await api.users();
      } else {
        result = await api.boardingStudents();
      }
      setRows(Array.isArray(result.data) ? result.data : []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Data gagal dimuat');
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, [variant]);

  const filtered = useMemo(() => {
    const keyword = search.toLowerCase();
    if (!keyword) return rows;
    return rows.filter((row) => JSON.stringify(row).toLowerCase().includes(keyword));
  }, [rows, search]);

  const columns = useMemo(() => columnsFor(variant), [variant]);

  function handleDownloadTemplate() {
    if (!importConfig) return;
    downloadImportTemplate(importConfig.template);
  }

  function handleExportRows() {
    if (filtered.length === 0) {
      setError('Belum ada data yang bisa diexport.');
      return;
    }
    exportRowsExcel(filtered, `${variant.replace(/-/g, '_')}_qomaruddin.xlsx`, `EXPORT ${current.title.toUpperCase()}`);
  }

  async function handleFileSelected(file?: File) {
    if (!file || !importConfig) return;
    setIsImporting(true);
    setError('');
    setNotice('');
    try {
      const parsed = await parseImportFile(file, importConfig.template, importConfig.forcedRole);
      if (parsed.length === 0) {
        setError('File kosong atau tidak ada baris data yang bisa diimport.');
        return;
      }
      const result = await importConfig.submit(parsed);
      await load();
      setNotice(importSummary(result));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Import gagal diproses.');
    } finally {
      setIsImporting(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  }

  return (
    <div className="space-y-6">
      <section className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm font-bold text-[#636E72]">Master Data</p>
          <h1 className="text-3xl font-extrabold text-[#2D3436]">{current.title}</h1>
          <p className="text-sm font-semibold text-[#636E72]">{current.subtitle}</p>
        </div>
        <button
          className={`q-refresh-button flex min-h-11 items-center gap-2 rounded-2xl bg-white px-4 text-sm font-bold text-[#138F81] ${isLoading ? 'is-loading' : ''}`}
          onClick={() => void load()}
          type="button"
          disabled={isLoading}
          aria-busy={isLoading}
        >
          <RefreshCw className="q-refresh-icon" size={17} />
          {isLoading ? 'Menyegarkan...' : 'Refresh'}
        </button>
      </section>

      {error ? <div className="rounded-2xl bg-[#FDECEC] px-4 py-3 text-sm font-bold text-[#D63031]">{error}</div> : null}
      {notice ? <div className="rounded-2xl bg-[#E8F7F3] px-4 py-3 text-sm font-bold text-[#138F81]">{notice}</div> : null}

      <div className="grid gap-4 md:grid-cols-3">
        <StatCard title="Total Data" value={rows.length} subtitle={`${filtered.length} data tampil`} icon={Icon} tone="teal" />
        <StatCard title="Aktif" value={countStatus(rows, 'Aktif')} subtitle="Data status aktif" icon={Search} tone="blue" />
        <StatCard title="Nonaktif" value={countStatus(rows, 'Nonaktif')} subtitle="Data status nonaktif" icon={UsersRound} tone="orange" />
      </div>

      <section className="q-panel p-4 sm:p-6">
        <div className="mb-5 flex flex-col gap-3 lg:flex-row lg:items-center">
          <div className="min-w-0 flex-1">
            <SearchInput value={search} onChange={setSearch} placeholder={current.search} />
          </div>
          <div className="flex flex-wrap gap-2">
            {importConfig ? (
              <>
                <button className="q-soft-action inline-flex min-h-11 items-center gap-2 rounded-2xl bg-white px-4 text-sm font-extrabold text-[#138F81]" onClick={handleDownloadTemplate} type="button">
                  <Download size={17} /> Template
                </button>
                <button
                  className="q-soft-action inline-flex min-h-11 items-center gap-2 rounded-2xl bg-[#138F81] px-4 text-sm font-extrabold text-white disabled:opacity-60"
                  onClick={() => fileInputRef.current?.click()}
                  type="button"
                  disabled={isImporting}
                >
                  <Upload size={17} /> {isImporting ? 'Mengimport...' : 'Import'}
                </button>
                <input
                  ref={fileInputRef}
                  className="hidden"
                  type="file"
                  accept=".xlsx"
                  onChange={(event) => void handleFileSelected(event.target.files?.[0] ?? undefined)}
                />
              </>
            ) : null}
            <button className="q-soft-action inline-flex min-h-11 items-center gap-2 rounded-2xl bg-white px-4 text-sm font-extrabold text-[#138F81]" onClick={handleExportRows} type="button">
              <FileSpreadsheet size={17} /> Export
            </button>
          </div>
        </div>
        {isLoading ? (
          <div className="rounded-2xl bg-white px-4 py-8 text-center text-sm font-bold text-[#636E72]">Memuat data...</div>
        ) : (
          <DataTable rows={filtered} columns={columns} emptyText="Data belum tersedia." />
        )}
      </section>
    </div>
  );
}

function columnsFor(variant: MasterVariant): DataColumn<ApiRecord>[] {
  if (variant === 'guru' || variant === 'login-guru') {
    return [
      { key: 'name', header: 'Nama Guru', render: (row) => <span className="font-extrabold">{text(row.name)}</span> },
      { key: 'email', header: 'Email', render: (row) => text(row.email) },
      { key: 'kode', header: 'Kode Guru', render: (row) => text(row.kode_guru ?? row.nis) },
      { key: 'unit', header: 'Unit', render: (row) => Array.isArray(row.unit_kerja) ? row.unit_kerja.join(', ') : text(row.unit_kerja) },
      { key: 'status', header: 'Status', render: (row) => <StatusBadge label={text(row.status, 'Aktif')} tone={text(row.status).toLowerCase() === 'nonaktif' ? 'danger' : 'success'} /> }
    ];
  }
  if (variant === 'users' || variant === 'login-admin' || variant === 'login-wali') {
    return [
      { key: 'name', header: 'Nama User', render: (row) => <span className="font-extrabold">{text(row.name)}</span> },
      { key: 'email', header: 'Email', render: (row) => text(row.email) },
      { key: 'phone', header: 'No HP', render: (row) => text(row.no_hp) },
      { key: 'role', header: 'Role', render: (row) => <StatusBadge label={text(row.role)} tone={text(row.role) === 'admin' ? 'success' : 'info'} /> },
      { key: 'admin', header: 'Tipe Admin', render: (row) => text(row.admin_type) },
      { key: 'status', header: 'Status', render: (row) => <StatusBadge label={text(row.status, 'Aktif')} tone={text(row.status).toLowerCase() === 'nonaktif' ? 'danger' : 'success'} /> }
    ];
  }
  if (variant === 'pondok') {
    return [
      { key: 'nama', header: 'Santri', render: (row) => <span className="font-extrabold">{text(row.siswa_nama ?? row.nama)}</span> },
      { key: 'nis', header: 'NIS', render: (row) => text(row.nis ?? record(row.siswa).nis) },
      { key: 'kelas', header: 'Kelas', render: (row) => text(row.kelas ?? record(row.siswa).kelas) },
      { key: 'komplek', header: 'Komplek', render: (row) => text(row.complex_name ?? row.komplek ?? record(row.complex).name) },
      { key: 'kamar', header: 'Kamar', render: (row) => text(row.room_name ?? row.kamar ?? record(row.room).name) },
      { key: 'status', header: 'Status', render: (row) => <StatusBadge label={row.is_active === false ? 'Nonaktif' : 'Aktif'} tone={row.is_active === false ? 'danger' : 'success'} /> }
    ];
  }
  return [
    { key: 'nama', header: 'Nama Siswa', render: (row) => <span className="font-extrabold">{text(row.nama)}</span> },
    { key: 'nis', header: 'NIS', render: (row) => text(row.nis) },
    { key: 'nisn', header: 'NISN', render: (row) => text(row.nisn) },
    { key: 'kelas', header: 'Kelas', render: (row) => text(row.kelas) },
    { key: 'wali', header: 'Wali', render: (row) => text(row.wali_nama ?? row.nama_wali) },
    { key: 'status', header: 'Status', render: (row) => <StatusBadge label={text(row.status, 'Aktif')} tone={text(row.status).toLowerCase() === 'nonaktif' ? 'danger' : 'success'} /> }
  ];
}

function getImportConfig(variant: MasterVariant): null | {
  template: ImportTemplateType;
  forcedRole?: 'admin' | 'guru' | 'wali';
  submit: (rows: ApiRecord[]) => Promise<ImportResult>;
} {
  if (variant === 'siswa') {
    return { template: 'siswa', submit: api.importSiswa };
  }
  if (variant === 'guru' || variant === 'login-guru') {
    return { template: 'guru', forcedRole: 'guru', submit: api.importGuru };
  }
  if (variant === 'login-admin') {
    return { template: 'user-admin', forcedRole: 'admin', submit: api.importUsers };
  }
  if (variant === 'login-wali') {
    return { template: 'user-wali', forcedRole: 'wali', submit: api.importUsers };
  }
  if (variant === 'users') {
    return { template: 'user', submit: api.importUsers };
  }
  return null;
}

function importSummary(result: ImportResult): string {
  const warningCount = result.warnings?.length ?? 0;
  const suffix = warningCount > 0 ? `, ${warningCount} warning` : '';
  return `Import selesai: ${result.berhasil} berhasil, ${result.gagal} gagal${suffix}.`;
}
