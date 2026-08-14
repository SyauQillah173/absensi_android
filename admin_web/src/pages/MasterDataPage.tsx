import {
  Building2,
  CheckCircle2,
  Download,
  Eye,
  FileSpreadsheet,
  GraduationCap,
  KeyRound,
  Pencil,
  Plus,
  RefreshCw,
  Search,
  Trash2,
  Upload,
  UsersRound,
  XCircle
} from 'lucide-react';
import { FormEvent, type ComponentType, useEffect, useMemo, useRef, useState } from 'react';
import { ComplexPondokForm } from '../components/ComplexPondokForm';
import { ComplexSiswaForm } from '../components/ComplexSiswaForm';
import { ComplexUserForm } from '../components/ComplexUserForm';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { DataTable, type DataColumn } from '../components/DataTable';
import { ModalForm } from '../components/ModalForm';
import { SearchInput } from '../components/SearchInput';
import { StatCard } from '../components/StatCard';
import { StatusBadge } from '../components/StatusBadge';
import { api, type ApiRecord, type ImportResult } from '../services/api';
import { downloadImportTemplate, exportRowsExcel, parseImportFile, type ImportTemplateType } from '../utils/importTemplates';

export type MasterVariant = 'siswa' | 'guru' | 'users' | 'login-admin' | 'login-guru' | 'login-wali' | 'pondok';
type SiswaStatus = 'Aktif' | 'Nonaktif' | 'Lulus';
type UserStatus = 'Aktif' | 'Nonaktif';

interface MasterDataPageProps {
  variant: MasterVariant;
}


interface UserFormState {
  id?: number;
  name: string;
  email: string;
  no_hp: string;
  role: string;
  admin_type: string;
  status: UserStatus;
  kode_guru: string;
  password: string;
}

const config = {
  siswa: {
    title: 'Buku Induk - Data Siswa/Santri',
    subtitle: 'Daftar siswa/santri dari backend yang sama dengan Android.',
    search: 'Cari nama / NIS / NISN / kelas',
    icon: UsersRound
  },
  guru: {
    title: 'Data Guru',
    subtitle: 'Guru dan akun pengajar aktif.',
    search: 'Cari nama / email / kode guru',
    icon: GraduationCap
  },
  users: {
    title: 'User Login',
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

function optionalText(value: unknown): string {
  const result = String(value ?? '').trim();
  return result === '-' ? '' : result;
}

function num(value: unknown): number {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function record(value: unknown): ApiRecord {
  return value && typeof value === 'object' && !Array.isArray(value) ? (value as ApiRecord) : {};
}

function countStatus(rows: ApiRecord[], status: string): number {
  return rows.filter((row) => text(row.status, '').toLowerCase() === status.toLowerCase()).length;
}

function statusTone(status: unknown) {
  const value = text(status, 'Aktif').toLowerCase();
  if (value === 'nonaktif') return 'danger' as const;
  if (value === 'lulus') return 'info' as const;
  return 'success' as const;
}

function isUserVariant(variant: MasterVariant): boolean {
  return variant === 'guru' || variant === 'users' || variant === 'login-admin' || variant === 'login-guru' || variant === 'login-wali';
}

function roleForVariant(variant: MasterVariant): string {
  if (variant === 'guru' || variant === 'login-guru') return 'guru';
  if (variant === 'login-admin') return 'admin';
  if (variant === 'login-wali') return 'wali';
  return '';
}

function newUserForm(variant: MasterVariant, row?: ApiRecord): UserFormState {
  const forcedRole = roleForVariant(variant);
  return {
    id: row?.id ? num(row.id) : undefined,
    name: optionalText(row?.name),
    email: optionalText(row?.email),
    no_hp: optionalText(row?.no_hp),
    role: forcedRole || optionalText(row?.role) || 'admin',
    admin_type: optionalText(row?.admin_type) || (forcedRole === 'admin' ? 'utama' : ''),
    status: text(row?.status, 'Aktif') === 'Nonaktif' ? 'Nonaktif' : 'Aktif',
    kode_guru: optionalText(row?.kode_guru ?? row?.nis),
    password: ''
  };
}

export function MasterDataPage({ variant }: MasterDataPageProps) {
  const [rows, setRows] = useState<ApiRecord[]>([]);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('Semua');
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [siswaForm, setSiswaForm] = useState<ApiRecord | null>(null);
  const [userForm, setUserForm] = useState<UserFormState | null>(null);
  const [detailTarget, setDetailTarget] = useState<ApiRecord | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<ApiRecord | null>(null);
  const [resetTarget, setResetTarget] = useState<ApiRecord | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const current = config[variant];
  const Icon = current.icon;
  const importConfig = getImportConfig(variant);
  const userMode = isUserVariant(variant);
  const siswaMode = variant === 'siswa';
  const isSiswaFormOpen = siswaForm !== null;
  const pondokMode = variant === 'pondok';

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
      setSelectedIds(new Set());
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Data gagal dimuat');
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [variant]);



  const filtered = useMemo(() => {
    const keyword = search.toLowerCase();
    return rows.filter((row) => {
      if (siswaMode && statusFilter !== 'Semua' && text(row.status, 'Aktif') !== statusFilter) return false;
      const haystack = JSON.stringify(row).toLowerCase();
      return keyword ? haystack.includes(keyword) : true;
    });
  }, [rows, search, siswaMode, statusFilter]);

  const selectedCount = selectedIds.size;
  const allVisibleSelected = filtered.length > 0 && filtered.every((row) => selectedIds.has(num(row.id)));

  const columns = useMemo(() => columnsFor(variant, {
    onDetail: setDetailTarget,
    onEdit: (row) => {
      if (siswaMode) setSiswaForm(row);
      else if (userMode) setUserForm(newUserForm(variant, row));
      else setDetailTarget(row);
    },
    onReset: (row) => setResetTarget(row),
    onDelete: (row) => setDeleteTarget(row),
    onStatus: (row, status) => {
      if (siswaMode) void updateOneSiswaStatus(row, status as SiswaStatus);
      else if (userMode) void updateOneUserStatus(row, status as UserStatus);
    },
    isSelected: (id) => selectedIds.has(id),
    onToggleSelect: (id) => toggleSelected(id)
  }), [variant, selectedIds, siswaMode, userMode]);

  function toggleSelected(id: number) {
    setSelectedIds((currentIds) => {
      const next = new Set(currentIds);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function selectAllFiltered() {
    setSelectedIds(new Set(filtered.map((row) => num(row.id)).filter(Boolean)));
  }

  function clearSelected() {
    setSelectedIds(new Set());
  }

  async function updateOneSiswaStatus(row: ApiRecord, status: SiswaStatus) {
    const id = num(row.id);
    if (!id || isSaving) return;
    setIsSaving(true);
    setError('');
    try {
      await api.updateSiswa(id, { status, ...(status === 'Lulus' ? { tahun_lulus: new Date().getFullYear() } : {}) });
      setNotice(`Status ${text(row.nama)} berhasil menjadi ${status}.`);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Status siswa/santri gagal diperbarui.');
    } finally {
      setIsSaving(false);
    }
  }

  async function updateOneUserStatus(row: ApiRecord, status: UserStatus) {
    const id = num(row.id);
    if (!id || isSaving) return;
    setIsSaving(true);
    setError('');
    try {
      await api.updateUser(id, { status });
      setNotice(`Status ${text(row.name)} berhasil menjadi ${status}.`);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Status akun gagal diperbarui.');
    } finally {
      setIsSaving(false);
    }
  }

  async function bulkStatus(status: SiswaStatus) {
    if (!siswaMode || selectedIds.size === 0 || isSaving) return;
    setIsSaving(true);
    setError('');
    try {
      await api.bulkUpdateSiswaStatus(Array.from(selectedIds), status, status === 'Lulus' ? { tahun_lulus: new Date().getFullYear() } : {});
      setNotice(`${selectedIds.size} siswa/santri berhasil diperbarui menjadi ${status}.`);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Bulk status gagal diproses.');
    } finally {
      setIsSaving(false);
    }
  }



  async function deleteRecord() {
    if (!deleteTarget?.id || isSaving) return;
    setIsSaving(true);
    setError('');
    try {
      if (siswaMode) await api.deleteSiswa(num(deleteTarget.id));
      else if (userMode) await api.deleteUser(num(deleteTarget.id));
      else throw new Error('Penghapusan data ini dikelola dari halaman khusus.');
      setDeleteTarget(null);
      setNotice('Data berhasil dihapus/nonaktif sesuai aturan backend.');
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Data gagal dihapus.');
    } finally {
      setIsSaving(false);
    }
  }

  async function resetPassword() {
    if (!resetTarget?.id || isSaving) return;
    setIsSaving(true);
    setError('');
    try {
      const result = await api.resetUserPassword(num(resetTarget.id));
      const temporaryPassword = text(record(result.data).temporary_password ?? record(result.data).password, '');
      setNotice(temporaryPassword ? `Password sementara: ${temporaryPassword}` : 'Password akun berhasil direset.');
      setResetTarget(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Password gagal direset.');
    } finally {
      setIsSaving(false);
    }
  }

  async function handleDownloadTemplate() {
    if (!importConfig) return;
    setError('');
    setNotice('');
    try {
      await downloadImportTemplate(importConfig.template);
      setNotice('Template import terbaru berhasil dibuat.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Template gagal dibuat.');
    }
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

  if (isSiswaFormOpen) {
    return (
      <ComplexSiswaForm
        initialData={siswaForm}
        onClose={() => setSiswaForm(null)}
        onSave={() => {
          setSiswaForm(null);
          void load();
        }}
      />
    );
  }

  if (userForm) {
    return (
      <ComplexUserForm
        initialData={userForm.id ? userForm : null}
        forcedRole={roleForVariant(variant)}
        onClose={() => setUserForm(null)}
        onSave={() => {
          setUserForm(null);
          void load();
        }}
      />
    );
  }

  if (detailTarget) {
    if (siswaMode) {
      return (
        <ComplexSiswaForm
          initialData={detailTarget}
          readOnly={true}
          onClose={() => setDetailTarget(null)}
          onSave={() => {}}
        />
      );
    }
    
    if (userMode) {
      return (
        <ComplexUserForm
          initialData={detailTarget}
          readOnly={true}
          onClose={() => setDetailTarget(null)}
          onSave={() => {}}
        />
      );
    }

    if (pondokMode) {
      return (
        <ComplexPondokForm
          initialData={detailTarget}
          onClose={() => setDetailTarget(null)}
        />
      );
    }
  }

  return (
    <div className="space-y-6">
      <section className="q-page-heading flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm font-bold text-[#636E72]">Master Data</p>
          <h1 className="text-3xl font-extrabold text-[#2D3436]">{current.title}</h1>
          <p className="text-sm font-semibold text-[#636E72]">{current.subtitle}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {!pondokMode ? (
            <button
              className="inline-flex min-h-11 items-center gap-2 rounded-2xl bg-[#138F81] px-4 text-sm font-extrabold text-white shadow-lg shadow-[#138F81]/20"
              onClick={() => {
                if (siswaMode) setSiswaForm({});
                else if (userMode) setUserForm(newUserForm(variant));
              }}
              type="button"
            >
              <Plus size={17} /> Tambah Data
            </button>
          ) : null}
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
        </div>
      </section>

      {error ? <div className="rounded-2xl bg-[#FDECEC] px-4 py-3 text-sm font-bold text-[#D63031]">{error}</div> : null}
      {notice ? <div className="rounded-2xl bg-[#E8F7F3] px-4 py-3 text-sm font-bold text-[#138F81]">{notice}</div> : null}

      <div className="q-stat-grid grid gap-4 md:grid-cols-3">
        <StatCard title="Total Data" value={rows.length} subtitle={`${filtered.length} data tampil`} icon={Icon} tone="teal" />
        <StatCard title="Aktif" value={countStatus(rows, 'Aktif')} subtitle="Data status aktif" icon={Search} tone="blue" />
        <StatCard title={siswaMode ? 'Lulus/Nonaktif' : 'Nonaktif'} value={siswaMode ? countStatus(rows, 'Lulus') + countStatus(rows, 'Nonaktif') : countStatus(rows, 'Nonaktif')} subtitle={siswaMode ? 'Data arsip dan nonaktif' : 'Data status nonaktif'} icon={UsersRound} tone="orange" />
      </div>

      {siswaMode ? (
        <section className="q-panel p-4 sm:p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap gap-2">
              {(['Semua', 'Aktif', 'Nonaktif', 'Lulus'] as const).map((status) => (
                <button
                  key={status}
                  className={`min-h-10 rounded-2xl px-4 text-sm font-extrabold ${statusFilter === status ? 'bg-[#138F81] text-white shadow-lg shadow-[#138F81]/20' : 'bg-white text-[#636E72]'}`}
                  onClick={() => {
                    setStatusFilter(status);
                    clearSelected();
                  }}
                  type="button"
                >
                  {status}
                </button>
              ))}
            </div>
            <div className="flex flex-wrap items-center gap-2 text-sm font-bold text-[#636E72]">
              <span>{selectedCount} dipilih</span>
              <button className="rounded-2xl bg-white px-3 py-2 text-[#138F81]" onClick={allVisibleSelected ? clearSelected : selectAllFiltered} type="button">
                {allVisibleSelected ? 'Batal pilih semua' : 'Pilih semua hasil'}
              </button>
              <button className="rounded-2xl bg-white px-3 py-2 text-[#D63031]" onClick={clearSelected} type="button" disabled={selectedCount === 0}>
                Bersihkan
              </button>
            </div>
          </div>
          {selectedCount > 0 ? (
            <div className="mt-4 flex flex-wrap gap-2">
              <button className="rounded-2xl bg-[#138F81] px-4 py-2 text-sm font-extrabold text-white" onClick={() => void bulkStatus('Aktif')} type="button" disabled={isSaving}>
                Aktifkan
              </button>
              <button className="rounded-2xl bg-[#E8590C] px-4 py-2 text-sm font-extrabold text-white" onClick={() => void bulkStatus('Nonaktif')} type="button" disabled={isSaving}>
                Nonaktifkan
              </button>
              <button className="rounded-2xl bg-[#2E86DE] px-4 py-2 text-sm font-extrabold text-white" onClick={() => void bulkStatus('Lulus')} type="button" disabled={isSaving}>
                Luluskan
              </button>
            </div>
          ) : null}
        </section>
      ) : null}

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
          <DataTable rows={filtered} columns={columns} emptyText="Data belum tersedia." mobileRender={(row) => renderMobileCard(variant, row, {
            selected: selectedIds.has(num(row.id)),
            onSelect: () => toggleSelected(num(row.id)),
            onDetail: () => setDetailTarget(row),
            onEdit: () => {
              if (siswaMode) setSiswaForm(row);
              else if (userMode) setUserForm(newUserForm(variant, row));
            },
            onReset: () => setResetTarget(row),
            onDelete: () => setDeleteTarget(row),
            onStatus: (status) => {
              if (siswaMode) void updateOneSiswaStatus(row, status as SiswaStatus);
              else if (userMode) void updateOneUserStatus(row, status as UserStatus);
            }
          })} />
        )}
      </section>

      {detailTarget && !siswaMode && !userMode && !pondokMode ? <DetailModal row={detailTarget} variant={variant} onClose={() => setDetailTarget(null)} /> : null}
      {deleteTarget ? (
        <ConfirmDialog
          title="Hapus Data?"
          message={`Data ${text(deleteTarget.nama ?? deleteTarget.name)} akan diproses. Jika sudah punya riwayat, backend akan menjaga data lama tetap aman.`}
          tone="danger"
          confirmLabel="Hapus"
          isBusy={isSaving}
          onCancel={() => setDeleteTarget(null)}
          onConfirm={() => void deleteRecord()}
        />
      ) : null}

      {resetTarget ? (
        <ConfirmDialog
          title="Reset Password?"
          message={`Password ${text(resetTarget.name)} akan diganti menjadi password sementara baru.`}
          tone="warning"
          confirmLabel="Reset"
          isBusy={isSaving}
          onCancel={() => setResetTarget(null)}
          onConfirm={() => void resetPassword()}
        />
      ) : null}
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  type = 'text',
  required = false,
  datalistId,
  datalistOptions = []
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: string;
  required?: boolean;
  datalistId?: string;
  datalistOptions?: string[];
}) {
  const options = Array.from(new Set(datalistOptions.map((option) => option.trim()).filter(Boolean)));
  return (
    <label className="block">
      <span className="mb-2 block text-sm font-bold text-[#636E72]">{label}</span>
      <input className="q-input" type={type} value={value} list={options.length ? datalistId : undefined} onChange={(event) => onChange(event.target.value)} required={required} />
      {datalistId && options.length ? (
        <datalist id={datalistId}>
          {options.map((option) => <option key={option} value={option} />)}
        </datalist>
      ) : null}
    </label>
  );
}

function DetailModal({ row, variant, onClose }: { row: ApiRecord; variant: MasterVariant; onClose: () => void }) {
  const entries = detailEntries(row, variant);
  return (
    <ModalForm title="Detail Data" onClose={onClose}>
      <div className="grid gap-3">
        {entries.map(([label, value]) => (
          <div key={label} className="rounded-2xl bg-white p-4">
            <p className="text-xs font-extrabold uppercase tracking-wide text-[#636E72]">{label}</p>
            <p className="mt-1 break-words text-sm font-bold text-[#2D3436]">{value}</p>
          </div>
        ))}
      </div>
    </ModalForm>
  );
}

function detailEntries(row: ApiRecord, variant: MasterVariant): Array<[string, string]> {
  if (variant === 'siswa') {
    return [
      ['Nama', text(row.nama)],
      ['NIS', text(row.nis)],
      ['NISN', text(row.nisn)],
      ['Kelas', text(row.kelas)],
      ['Wali', text(row.wali_nama ?? row.nama_wali)],
      ['Kontak Wali', text(row.no_telepon_wali)],
      ['Status', text(row.status, 'Aktif')],
      ['Alamat', text(row.alamat)]
    ];
  }
  if (isUserVariant(variant)) {
    return [
      ['Nama', text(row.name)],
      ['Email', text(row.email)],
      ['No HP', text(row.no_hp)],
      ['Role', text(row.role)],
      ['Tipe Admin', text(row.admin_type)],
      ['Status', text(row.status, 'Aktif')]
    ];
  }
  return [
    ['Santri', text(row.siswa_nama ?? row.nama)],
    ['Komplek', text(row.complex_name ?? row.komplek ?? record(row.complex).name)],
    ['Kamar', text(row.room_name ?? row.kamar ?? record(row.room).name)],
    ['Status', row.is_active === false ? 'Nonaktif' : 'Aktif']
  ];
}

function renderMobileCard(variant: MasterVariant, row: ApiRecord, actions: {
  selected: boolean;
  onSelect: () => void;
  onDetail: () => void;
  onEdit: () => void;
  onReset: () => void;
  onDelete: () => void;
  onStatus: (status: string) => void;
}) {
  const isSiswa = variant === 'siswa';
  const isUser = isUserVariant(variant);
  const title = isSiswa ? text(row.nama) : isUser ? text(row.name) : text(row.siswa_nama ?? row.nama);
  const subtitle = isSiswa
    ? `${text(row.nis)} - ${text(row.nisn)} - ${text(row.kelas)}`
    : isUser
      ? `${text(row.email)} - ${text(row.role)}`
      : `${text(row.nis ?? record(row.siswa).nis)} - ${text(row.complex_name ?? row.komplek)} / ${text(row.room_name ?? row.kamar)}`;
  const status = isSiswa || isUser ? text(row.status, 'Aktif') : row.is_active === false ? 'Nonaktif' : 'Aktif';
  return (
    <article className="rounded-3xl bg-white p-4 shadow-sm shadow-black/5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="break-words text-base font-extrabold text-[#2D3436]">{title}</h3>
          <p className="mt-1 text-xs font-semibold leading-5 text-[#636E72]">{subtitle}</p>
        </div>
        <StatusBadge label={status} tone={statusTone(status)} />
      </div>
      {isSiswa ? (
        <div className="mt-3 grid gap-1 text-xs font-bold text-[#636E72]">
          <span>Wali: {text(row.wali_nama ?? row.nama_wali)}</span>
          <label className="inline-flex items-center gap-2 text-[#138F81]">
            <input type="checkbox" checked={actions.selected} onChange={actions.onSelect} />
            Pilih siswa/santri
          </label>
        </div>
      ) : null}
      <div className="mt-4 flex flex-wrap gap-2">
        <ActionButton icon={Eye} label="Detail" onClick={actions.onDetail} />
        {(isSiswa || isUser) ? <ActionButton icon={Pencil} label="Edit" onClick={actions.onEdit} /> : null}
        {isUser ? <ActionButton icon={KeyRound} label="Reset" onClick={actions.onReset} /> : null}
        {isSiswa ? (
          <>
            <ActionButton icon={CheckCircle2} label="Aktif" onClick={() => actions.onStatus('Aktif')} />
            <ActionButton icon={XCircle} label="Nonaktif" onClick={() => actions.onStatus('Nonaktif')} tone="warning" />
            <ActionButton icon={GraduationCap} label="Lulus" onClick={() => actions.onStatus('Lulus')} tone="info" />
          </>
        ) : null}
        {isUser ? (
          <ActionButton icon={status === 'Aktif' ? XCircle : CheckCircle2} label={status === 'Aktif' ? 'Nonaktif' : 'Aktif'} onClick={() => actions.onStatus(status === 'Aktif' ? 'Nonaktif' : 'Aktif')} tone={status === 'Aktif' ? 'warning' : 'success'} />
        ) : null}
        {(isSiswa || isUser) ? <ActionButton icon={Trash2} label="Hapus" onClick={actions.onDelete} tone="danger" /> : null}
      </div>
    </article>
  );
}

function ActionButton({ icon: Icon, label, onClick, tone = 'default' }: { icon: ComponentType<{ size?: number }>; label: string; onClick: () => void; tone?: 'default' | 'danger' | 'warning' | 'success' | 'info' }) {
  const color = tone === 'danger'
    ? 'bg-[#FDECEC] text-[#D63031]'
    : tone === 'warning'
      ? 'bg-[#FFF3E0] text-[#E8590C]'
      : tone === 'success'
        ? 'bg-[#E8F7F3] text-[#138F81]'
        : tone === 'info'
          ? 'bg-[#EAF4FF] text-[#2E86DE]'
          : 'bg-[#E1EFF7] text-[#138F81]';
  return (
    <button className={`inline-flex min-h-10 items-center gap-2 rounded-2xl px-3 text-xs font-extrabold ${color}`} onClick={onClick} type="button">
      <Icon size={14} /> {label}
    </button>
  );
}

interface ColumnCallbacks {
  onDetail: (row: ApiRecord) => void;
  onEdit: (row: ApiRecord) => void;
  onReset: (row: ApiRecord) => void;
  onDelete: (row: ApiRecord) => void;
  onStatus: (row: ApiRecord, status: string) => void;
  isSelected: (id: number) => boolean;
  onToggleSelect: (id: number) => void;
}

function columnsFor(variant: MasterVariant, callbacks: ColumnCallbacks): DataColumn<ApiRecord>[] {
  const actionColumn: DataColumn<ApiRecord> = {
    key: 'aksi',
    header: 'Aksi',
    render: (row) => (
      <div className="flex flex-wrap gap-2">
        <ActionButton icon={Eye} label="Detail" onClick={() => callbacks.onDetail(row)} />
        {(variant !== 'pondok') ? <ActionButton icon={Pencil} label="Edit" onClick={() => callbacks.onEdit(row)} /> : null}
        {isUserVariant(variant) ? <ActionButton icon={KeyRound} label="Reset" onClick={() => callbacks.onReset(row)} /> : null}
        {variant === 'siswa' ? (
          <>
            <ActionButton icon={CheckCircle2} label="Aktif" onClick={() => callbacks.onStatus(row, 'Aktif')} />
            <ActionButton icon={XCircle} label="Nonaktif" onClick={() => callbacks.onStatus(row, 'Nonaktif')} tone="warning" />
            <ActionButton icon={GraduationCap} label="Lulus" onClick={() => callbacks.onStatus(row, 'Lulus')} tone="info" />
          </>
        ) : null}
        {isUserVariant(variant) ? (
          <ActionButton icon={text(row.status, 'Aktif') === 'Aktif' ? XCircle : CheckCircle2} label={text(row.status, 'Aktif') === 'Aktif' ? 'Nonaktif' : 'Aktif'} onClick={() => callbacks.onStatus(row, text(row.status, 'Aktif') === 'Aktif' ? 'Nonaktif' : 'Aktif')} tone={text(row.status, 'Aktif') === 'Aktif' ? 'warning' : 'success'} />
        ) : null}
        {(variant !== 'pondok') ? <ActionButton icon={Trash2} label="Hapus" onClick={() => callbacks.onDelete(row)} tone="danger" /> : null}
      </div>
    )
  };

  if (variant === 'guru' || variant === 'login-guru') {
    return [
      { key: 'name', header: 'Nama Guru', render: (row) => <span className="font-extrabold">{text(row.name)}</span> },
      { key: 'email', header: 'Email', render: (row) => text(row.email) },
      { key: 'kode', header: 'Kode Guru', render: (row) => text(row.kode_guru ?? row.nis) },
      { key: 'unit', header: 'Unit', render: (row) => Array.isArray(row.unit_kerja) ? row.unit_kerja.join(', ') : text(row.unit_kerja) },
      { key: 'status', header: 'Status', render: (row) => <StatusBadge label={text(row.status, 'Aktif')} tone={statusTone(row.status)} /> },
      actionColumn
    ];
  }
  if (variant === 'users' || variant === 'login-admin' || variant === 'login-wali') {
    return [
      { key: 'name', header: 'Nama User', render: (row) => <span className="font-extrabold">{text(row.name)}</span> },
      { key: 'email', header: 'Email', render: (row) => text(row.email) },
      { key: 'phone', header: 'No HP', render: (row) => text(row.no_hp) },
      { key: 'role', header: 'Role', render: (row) => <StatusBadge label={text(row.role)} tone={text(row.role) === 'admin' ? 'success' : 'info'} /> },
      { key: 'admin', header: 'Tipe Admin', render: (row) => text(row.admin_type) },
      { key: 'status', header: 'Status', render: (row) => <StatusBadge label={text(row.status, 'Aktif')} tone={statusTone(row.status)} /> },
      actionColumn
    ];
  }
  if (variant === 'pondok') {
    return [
      { key: 'nama', header: 'Santri', render: (row) => <span className="font-extrabold">{text(row.siswa_nama ?? row.nama)}</span> },
      { key: 'nis', header: 'NIS', render: (row) => text(row.nis ?? record(row.siswa).nis) },
      { key: 'kelas', header: 'Kelas', render: (row) => text(row.kelas ?? record(row.siswa).kelas) },
      { key: 'komplek', header: 'Komplek', render: (row) => text(row.complex_name ?? row.komplek ?? record(row.complex).name) },
      { key: 'kamar', header: 'Kamar', render: (row) => text(row.room_name ?? row.kamar ?? record(row.room).name) },
      { key: 'status', header: 'Status', render: (row) => <StatusBadge label={row.is_active === false ? 'Nonaktif' : 'Aktif'} tone={row.is_active === false ? 'danger' : 'success'} /> },
      actionColumn
    ];
  }
  return [
    {
      key: 'select',
      header: '',
      render: (row) => (
        <input type="checkbox" checked={callbacks.isSelected(num(row.id))} onChange={() => callbacks.onToggleSelect(num(row.id))} aria-label={`Pilih ${text(row.nama)}`} />
      )
    },
    { key: 'nama', header: 'Nama Siswa/Santri', render: (row) => <span className="font-extrabold">{text(row.nama)}</span> },
    { key: 'nis', header: 'NIS', render: (row) => text(row.nis) },
    { key: 'nisn', header: 'NISN', render: (row) => text(row.nisn) },
    { key: 'kelas', header: 'Kelas', render: (row) => text(row.kelas) },
    { key: 'wali', header: 'Wali', render: (row) => text(row.wali_nama ?? row.nama_wali) },
    { key: 'status', header: 'Status', render: (row) => <StatusBadge label={text(row.status, 'Aktif')} tone={statusTone(row.status)} /> },
    actionColumn
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
