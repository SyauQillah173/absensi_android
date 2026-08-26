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
  RotateCcw,
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

export type MasterVariant = 'siswa' | 'alumni' | 'guru' | 'users' | 'login-admin' | 'login-guru' | 'login-wali' | 'pondok';
type SiswaStatus = 'Aktif' | 'Nonaktif' | 'Lulus';
type UserStatus = 'Aktif' | 'Nonaktif';

interface MasterDataPageProps {
  variant: MasterVariant;
}

const config = {
  siswa: {
    title: 'Buku Induk - Data Siswa/Santri Aktif',
    subtitle: 'Daftar seluruh siswa/santri aktif dan baru di Pondok Pesantren Qomaruddin.',
    search: 'Cari nama / NIS / NISN / kelas',
    icon: UsersRound
  },
  alumni: {
    title: 'Buku Induk - Data Santri Alumni',
    subtitle: 'Daftar santri yang telah lulus madin, arsip kelulusan & alumni pesantren.',
    search: 'Cari nama / NIS / NISN / tahun lulus',
    icon: GraduationCap
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


export function MasterDataPage({ variant }: MasterDataPageProps) {
  const [rows, setRows] = useState<ApiRecord[]>([]);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('Semua');
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [siswaForm, setSiswaForm] = useState<ApiRecord | null>(null);
  const [userForm, setUserForm] = useState<ApiRecord | null>(null);
  const [detailTarget, setDetailTarget] = useState<ApiRecord | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<ApiRecord | null>(null);
  const [resetTarget, setResetTarget] = useState<ApiRecord | null>(null);
  const [restoreTarget, setRestoreTarget] = useState<ApiRecord | null>(null);
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
  const alumniMode = variant === 'alumni';
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
      } else if (variant === 'alumni') {
        result = await api.siswa({ status: 'Lulus', with_wali: 1 });
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
      if (siswaMode) {
        const rowStatus = text(row.status, 'Aktif');
        if (statusFilter === 'Semua') {
          if (rowStatus === 'Lulus') return false;
        } else if (rowStatus !== statusFilter) {
          return false;
        }
      }
      const haystack = JSON.stringify(row).toLowerCase();
      return keyword ? haystack.includes(keyword) : true;
    });
  }, [rows, search, siswaMode, statusFilter]);

  const selectedCount = selectedIds.size;
  const allVisibleSelected = filtered.length > 0 && filtered.every((row) => selectedIds.has(num(row.id)));

  const columns = useMemo(() => columnsFor(variant, {
    onDetail: setDetailTarget,
    onEdit: (row) => {
      if (siswaMode || alumniMode) setSiswaForm(row);
      else if (userMode) setUserForm(row);
      else setDetailTarget(row);
    },
    onReset: (row) => setResetTarget(row),
    onDelete: (row) => setDeleteTarget(row),
    onRestore: (row) => setRestoreTarget(row),
    onStatus: (row, status) => {
      if (siswaMode || alumniMode) void updateOneSiswaStatus(row, status as SiswaStatus);
      else if (userMode) void updateOneUserStatus(row, status as UserStatus);
    },
    isSelected: (id) => selectedIds.has(id),
    onToggleSelect: (id) => toggleSelected(id)
  }), [variant, selectedIds, siswaMode, alumniMode, userMode]);

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



  async function restoreAlumniRecord() {
    if (!restoreTarget?.id || isSaving) return;
    setIsSaving(true);
    setError('');
    try {
      await api.restoreAlumni(num(restoreTarget.id));
      setNotice(`Santri ${text(restoreTarget.nama)} berhasil dipulihkan menjadi Santri Aktif.`);
      setRestoreTarget(null);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Gagal memulihkan data alumni.');
    } finally {
      setIsSaving(false);
    }
  }

  async function deleteRecord() {
    if (!deleteTarget?.id || isSaving) return;
    setIsSaving(true);
    setError('');
    try {
      if (siswaMode || alumniMode) await api.deleteSiswa(num(deleteTarget.id));
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
                else if (userMode) setUserForm({});
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

      {alumniMode ? (
        <div className="q-stat-grid grid gap-4 md:grid-cols-3">
          <StatCard title="Total Santri Alumni" value={rows.length} subtitle={`${filtered.length} alumni terdata`} icon={GraduationCap} tone="purple" />
          <StatCard title="Alumni Laki-laki" value={rows.filter((r) => text(r.jenis_kelamin).toUpperCase() === 'L').length} subtitle="Santri Putra yang telah lulus" icon={UsersRound} tone="blue" />
          <StatCard title="Alumni Perempuan" value={rows.filter((r) => text(r.jenis_kelamin).toUpperCase() === 'P').length} subtitle="Santri Putri yang telah lulus" icon={UsersRound} tone="orange" />
        </div>
      ) : (
        <div className="q-stat-grid grid gap-4 md:grid-cols-3">
          <StatCard
            title={siswaMode ? 'Total Santri' : 'Total Data'}
            value={siswaMode ? rows.filter((r) => text(r.status, 'Aktif') !== 'Lulus').length : rows.length}
            subtitle={`${filtered.length} ${siswaMode ? 'santri' : 'data'} tampil`}
            icon={Icon}
            tone="teal"
          />
          <StatCard title="Aktif" value={countStatus(rows, 'Aktif')} subtitle="Data status aktif" icon={Search} tone="blue" />
          <StatCard title="Nonaktif" value={countStatus(rows, 'Nonaktif')} subtitle="Data status nonaktif" icon={UsersRound} tone="orange" />
        </div>
      )}

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
          <DataTable rows={filtered} columns={columns} emptyText="Data belum tersedia." minWidth="100%" mobileRender={(row) => renderMobileCard(variant, row, {
            selected: selectedIds.has(num(row.id)),
            onSelect: () => toggleSelected(num(row.id)),
            onDetail: () => setDetailTarget(row),
            onEdit: () => {
              if (siswaMode) setSiswaForm(row);
              else if (userMode) setUserForm(row);
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

      {restoreTarget ? (
        <ConfirmDialog
          title="Pulihkan Santri ke Status Aktif?"
          message={`Santri ${text(restoreTarget.nama)} akan dipulihkan dari status Alumni dan kembali menjadi Santri Aktif sehingga dapat mengikuti kegiatan belajar mengajar kembali.`}
          tone="info"
          confirmLabel="Ya, Pulihkan ke Aktif"
          isBusy={isSaving}
          onCancel={() => setRestoreTarget(null)}
          onConfirm={() => void restoreAlumniRecord()}
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
  if (variant === 'siswa' || variant === 'alumni') {
    return [
      ['Nama', text(row.nama)],
      ['NIS', text(row.nis)],
      ['NISN', text(row.nisn)],
      ['Tahun Lulus', text(row.tahun_lulus, '-')],
      ['Kelas / Madin', text(row.kelas)],
      ['Wali', text(row.wali_nama ?? row.nama_wali)],
      ['Kontak Wali', text(row.no_telepon_wali ?? row.no_whatsapp)],
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
    ? `${text(row.nis)} • ${text(row.kelas)}`
    : isUser
      ? `${text(row.email)} • ${text(row.role)}`
      : `${text(row.nis ?? record(row.siswa).nis)} • ${text(row.complex_name ?? row.komplek)} / ${text(row.room_name ?? row.kamar)}`;
  const status = isSiswa || isUser ? text(row.status, 'Aktif') : row.is_active === false ? 'Nonaktif' : 'Aktif';
  return (
    <article className="rounded-2xl bg-white p-4 shadow-sm border border-gray-100">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <h3 className="break-words text-base font-extrabold text-[#2D3436]">{title}</h3>
          <p className="mt-0.5 text-xs font-semibold text-[#636E72]">{subtitle}</p>
        </div>
        {isSiswa ? (
          <select
            className={`h-7 rounded-lg border-0 px-2 text-xs font-extrabold cursor-pointer transition-colors ${
              status === 'Aktif'
                ? 'bg-[#E8F7F3] text-[#138F81]'
                : status === 'Lulus'
                  ? 'bg-[#EAF4FF] text-[#2E86DE]'
                  : 'bg-[#FFF3E0] text-[#E8590C]'
            }`}
            value={status}
            onChange={(e) => actions.onStatus(e.target.value)}
          >
            <option value="Aktif">● Aktif</option>
            <option value="Nonaktif">● Nonaktif</option>
            <option value="Lulus">● Lulus</option>
          </select>
        ) : (
          <StatusBadge label={status} tone={statusTone(status)} />
        )}
      </div>
      {isSiswa ? (
        <div className="mt-2.5 flex items-center justify-between text-xs font-bold text-[#636E72]">
          <span>Wali: {text(row.wali_nama ?? row.nama_wali)}</span>
          <label className="inline-flex items-center gap-1.5 text-[#138F81] cursor-pointer">
            <input type="checkbox" checked={actions.selected} onChange={actions.onSelect} className="rounded" />
            Pilih
          </label>
        </div>
      ) : null}
      <div className="mt-3 flex flex-wrap items-center gap-1.5 pt-2 border-t border-gray-50">
        <ActionButton icon={Eye} label="Detail" onClick={actions.onDetail} />
        {(isSiswa || isUser) ? <ActionButton icon={Pencil} label="Edit" onClick={actions.onEdit} tone="info" /> : null}
        {isUser ? <ActionButton icon={KeyRound} label="Reset" onClick={actions.onReset} tone="warning" /> : null}
        {(isSiswa || isUser) ? <ActionButton icon={Trash2} label="Hapus" onClick={actions.onDelete} tone="danger" /> : null}
      </div>
    </article>
  );
}

function ActionButton({ icon: Icon, label, onClick, tone = 'default' }: { icon: ComponentType<{ size?: number }>; label: string; onClick: () => void; tone?: 'default' | 'danger' | 'warning' | 'success' | 'info' }) {
  const color = tone === 'danger'
    ? 'bg-[#FDECEC] text-[#D63031] hover:bg-[#fbdada]'
    : tone === 'warning'
      ? 'bg-[#FFF3E0] text-[#E8590C] hover:bg-[#ffe6c9]'
      : tone === 'success'
        ? 'bg-[#E8F7F3] text-[#138F81] hover:bg-[#d6f5ec]'
        : tone === 'info'
          ? 'bg-[#EAF4FF] text-[#2E86DE] hover:bg-[#d8ecff]'
          : 'bg-[#E1EFF7] text-[#138F81] hover:bg-[#cbe6f7]';
  return (
    <button className={`inline-flex h-8 items-center gap-1.5 rounded-xl px-2.5 text-xs font-extrabold transition-colors ${color}`} onClick={onClick} type="button">
      <Icon size={13} /> {label}
    </button>
  );
}

interface ColumnCallbacks {
  onDetail: (row: ApiRecord) => void;
  onEdit: (row: ApiRecord) => void;
  onReset: (row: ApiRecord) => void;
  onDelete: (row: ApiRecord) => void;
  onRestore?: (row: ApiRecord) => void;
  onStatus: (row: ApiRecord, status: string) => void;
  isSelected: (id: number) => boolean;
  onToggleSelect: (id: number) => void;
}

function columnsFor(variant: MasterVariant, callbacks: ColumnCallbacks): DataColumn<ApiRecord>[] {
  const actionColumn: DataColumn<ApiRecord> = {
    key: 'aksi',
    header: 'Aksi',
    className: 'text-right w-[140px]',
    render: (row) => (
      <div className="flex items-center justify-end gap-1.5 whitespace-nowrap">
        <button
          className="inline-flex h-8 items-center gap-1 rounded-xl bg-[#E1EFF7] px-2.5 text-xs font-extrabold text-[#138F81] hover:bg-[#cbe6f7] transition-colors"
          onClick={() => callbacks.onDetail(row)}
          type="button"
          title="Detail Lengkap"
        >
          <Eye size={13} /> Detail
        </button>
        {variant !== 'pondok' ? (
          <button
            className="inline-flex h-8 items-center gap-1 rounded-xl bg-[#EAF4FF] px-2.5 text-xs font-extrabold text-[#2E86DE] hover:bg-[#d8ecff] transition-colors"
            onClick={() => callbacks.onEdit(row)}
            type="button"
            title="Edit Data"
          >
            <Pencil size={13} /> Edit
          </button>
        ) : null}
        {isUserVariant(variant) ? (
          <button
            className="inline-flex h-8 items-center gap-1 rounded-xl bg-[#FFF3E0] px-2 text-xs font-extrabold text-[#E8590C] hover:bg-[#ffe6c9] transition-colors"
            onClick={() => callbacks.onReset(row)}
            type="button"
            title="Reset Password"
          >
            <KeyRound size={13} />
          </button>
        ) : null}
        {variant !== 'pondok' ? (
          <button
            className="inline-flex h-8 w-8 items-center justify-center rounded-xl bg-[#FDECEC] text-[#D63031] hover:bg-[#fbdada] transition-colors"
            onClick={() => callbacks.onDelete(row)}
            type="button"
            title="Hapus Data"
          >
            <Trash2 size={13} />
          </button>
        ) : null}
      </div>
    )
  };

  if (variant === 'guru' || variant === 'login-guru') {
    return [
      {
        key: 'name',
        header: 'Nama Guru',
        render: (row) => (
          <div>
            <span className="font-extrabold text-[#2D3436] text-sm block leading-tight">{text(row.name)}</span>
            <div className="mt-1 flex items-center gap-2 text-xs text-[#636E72]">
              <span className="font-mono bg-gray-100 px-1.5 py-0.5 rounded font-bold">Kode: {text(row.kode_guru ?? row.nis)}</span>
              {row.email ? <span>{text(row.email)}</span> : null}
            </div>
          </div>
        )
      },
      {
        key: 'unit',
        header: 'Unit Kerja',
        className: 'w-[180px]',
        render: (row) => <span className="text-xs font-bold text-[#636E72]">{text(Array.isArray(row.unit_kerja) ? row.unit_kerja.join(', ') : row.unit_kerja)}</span>
      },
      {
        key: 'status',
        header: 'Status',
        className: 'w-[120px]',
        render: (row) => (
          <select
            className={`h-7 rounded-lg border-0 px-2 text-xs font-extrabold cursor-pointer transition-colors ${
              text(row.status, 'Aktif') === 'Aktif'
                ? 'bg-[#E8F7F3] text-[#138F81]'
                : 'bg-[#FFF3E0] text-[#E8590C]'
            }`}
            value={text(row.status, 'Aktif')}
            onChange={(e) => callbacks.onStatus(row, e.target.value)}
          >
            <option value="Aktif">● Aktif</option>
            <option value="Nonaktif">● Nonaktif</option>
          </select>
        )
      },
      actionColumn
    ];
  }
  if (variant === 'users' || variant === 'login-admin' || variant === 'login-wali') {
    return [
      {
        key: 'name',
        header: 'Pengguna',
        render: (row) => (
          <div>
            <span className="font-extrabold text-[#2D3436] text-sm block leading-tight">{text(row.name)}</span>
            <span className="text-xs text-[#636E72] mt-0.5 block">{text(row.email)}</span>
          </div>
        )
      },
      { key: 'phone', header: 'No HP', className: 'w-[140px]', render: (row) => <span className="text-xs font-mono">{text(row.no_hp)}</span> },
      {
        key: 'role',
        header: 'Role & Akses',
        className: 'w-[160px]',
        render: (row) => (
          <div className="flex items-center gap-1.5">
            <StatusBadge label={text(row.role)} tone={text(row.role) === 'admin' ? 'success' : 'info'} />
            {row.admin_type ? <span className="text-[11px] font-bold text-[#636E72] bg-gray-100 px-1.5 py-0.5 rounded">{text(row.admin_type)}</span> : null}
          </div>
        )
      },
      {
        key: 'status',
        header: 'Status',
        className: 'w-[120px]',
        render: (row) => (
          <select
            className={`h-7 rounded-lg border-0 px-2 text-xs font-extrabold cursor-pointer transition-colors ${
              text(row.status, 'Aktif') === 'Aktif'
                ? 'bg-[#E8F7F3] text-[#138F81]'
                : 'bg-[#FFF3E0] text-[#E8590C]'
            }`}
            value={text(row.status, 'Aktif')}
            onChange={(e) => callbacks.onStatus(row, e.target.value)}
          >
            <option value="Aktif">● Aktif</option>
            <option value="Nonaktif">● Nonaktif</option>
          </select>
        )
      },
      actionColumn
    ];
  }
  if (variant === 'pondok') {
    return [
      {
        key: 'nama',
        header: 'Santri & NIS',
        render: (row) => (
          <div>
            <span className="font-extrabold text-[#2D3436] text-sm block leading-tight">{text(row.siswa_nama ?? row.nama)}</span>
            <span className="font-mono text-[11px] font-bold text-[#636E72] mt-0.5 block">NIS: {text(row.nis ?? record(row.siswa).nis)}</span>
          </div>
        )
      },
      {
        key: 'komplek',
        header: 'Komplek Asrama',
        className: 'w-[160px]',
        render: (row) => <span className="font-bold text-[#138F81] text-xs bg-[#E8F7F3] px-2 py-1 rounded-lg inline-block">{text(row.complex_name ?? row.komplek ?? record(row.complex).name)}</span>
      },
      {
        key: 'kamar',
        header: 'Kamar Asrama',
        className: 'w-[160px]',
        render: (row) => <span className="font-bold text-[#2D3436] text-xs bg-gray-100 px-2 py-1 rounded-lg inline-block">{text(row.room_name ?? row.kamar ?? record(row.room).name)}</span>
      },
      { key: 'status', header: 'Status', className: 'w-[120px]', render: (row) => <StatusBadge label={row.is_active === false ? 'Nonaktif' : 'Aktif'} tone={row.is_active === false ? 'danger' : 'success'} /> },
      actionColumn
    ];
  }
  if (variant === 'alumni') {
    return [
      {
        key: 'select',
        header: '',
        className: 'w-10 text-center px-2',
        render: (row) => (
          <input
            type="checkbox"
            checked={callbacks.isSelected(num(row.id))}
            onChange={() => callbacks.onToggleSelect(num(row.id))}
            aria-label={`Pilih ${text(row.nama)}`}
            className="rounded border-gray-300 text-[#6C5CE7] focus:ring-[#6C5CE7] cursor-pointer"
          />
        )
      },
      {
        key: 'nama',
        header: 'Nama Santri Alumni',
        render: (row) => (
          <div className="py-0.5">
            <span className="font-extrabold text-[#2D3436] text-sm block leading-tight">{text(row.nama)}</span>
            <div className="mt-1 flex flex-wrap items-center gap-1.5 text-[11px] font-semibold text-[#636E72]">
              <span className="font-mono bg-gray-100 px-1.5 py-0.5 rounded text-gray-700 font-bold">NIS: {text(row.nis)}</span>
              {row.nisn ? (
                <span className="font-mono bg-blue-50 px-1.5 py-0.5 rounded text-[#2E86DE] font-bold">NISN: {text(row.nisn)}</span>
              ) : null}
            </div>
          </div>
        )
      },
      {
        key: 'tahun_lulus',
        header: 'Tahun Kelulusan',
        className: 'w-[140px]',
        render: (row) => (
          <span className="font-bold text-[#6C5CE7] bg-[#F0ECFF] px-2.5 py-1 rounded-xl text-xs inline-flex items-center gap-1">
            🎓 {text(row.tahun_lulus, '-')}
          </span>
        )
      },
      {
        key: 'kelas',
        header: 'Madin Terakhir',
        className: 'w-[140px]',
        render: (row) => <span className="text-xs font-bold text-[#2D3436]">{text(row.kelas, 'Sifir Sadis')}</span>
      },
      {
        key: 'wali',
        header: 'Wali / Kontak',
        className: 'w-[160px]',
        render: (row) => {
          const wali = text(row.wali_nama ?? row.nama_wali, '');
          const hp = text(row.no_telepon_wali ?? row.no_whatsapp, '');
          return (
            <div className="text-xs">
              <span className="font-bold text-[#2D3436] block">{wali || '-'}</span>
              {hp && hp !== '-' ? <span className="text-[#636E72] font-mono text-[11px] block">{hp}</span> : null}
            </div>
          );
        }
      },
      {
        key: 'status',
        header: 'Status',
        className: 'w-[110px]',
        render: () => <StatusBadge label="Lulus (Alumni)" tone="info" />
      },
      {
        key: 'aksi',
        header: 'Aksi',
        className: 'text-right w-[190px]',
        render: (row) => (
          <div className="flex items-center justify-end gap-1.5 whitespace-nowrap">
            <button
              className="inline-flex h-8 items-center gap-1 rounded-xl bg-[#E1EFF7] px-2.5 text-xs font-extrabold text-[#138F81] hover:bg-[#cbe6f7] transition-colors"
              onClick={() => callbacks.onDetail(row)}
              type="button"
              title="Detail Profil Alumni"
            >
              <Eye size={13} /> Detail
            </button>
            <button
              className="inline-flex h-8 items-center gap-1 rounded-xl bg-[#F0ECFF] px-2.5 text-xs font-extrabold text-[#6C5CE7] hover:bg-[#e2dbff] transition-colors"
              onClick={() => callbacks.onRestore?.(row)}
              type="button"
              title="Pulihkan kembali menjadi Santri Aktif"
            >
              <RotateCcw size={13} /> Pulihkan
            </button>
            <button
              className="inline-flex h-8 w-8 items-center justify-center rounded-xl bg-[#FDECEC] text-[#D63031] hover:bg-[#fbdada] transition-colors"
              onClick={() => callbacks.onDelete(row)}
              type="button"
              title="Hapus Data"
            >
              <Trash2 size={13} />
            </button>
          </div>
        )
      }
    ];
  }
  return [
    {
      key: 'select',
      header: '',
      className: 'w-10 text-center px-2',
      render: (row) => (
        <input
          type="checkbox"
          checked={callbacks.isSelected(num(row.id))}
          onChange={() => callbacks.onToggleSelect(num(row.id))}
          aria-label={`Pilih ${text(row.nama)}`}
          className="rounded border-gray-300 text-[#138F81] focus:ring-[#138F81] cursor-pointer"
        />
      )
    },
    {
      key: 'nama',
      header: 'Nama Siswa / Santri',
      render: (row) => (
        <div className="py-0.5">
          <span className="font-extrabold text-[#2D3436] text-sm block leading-tight">{text(row.nama)}</span>
          <div className="mt-1 flex flex-wrap items-center gap-1.5 text-[11px] font-semibold text-[#636E72]">
            <span className="font-mono bg-gray-100 px-1.5 py-0.5 rounded text-gray-700 font-bold">NIS: {text(row.nis)}</span>
            {row.nisn ? (
              <span className="font-mono bg-blue-50 px-1.5 py-0.5 rounded text-[#2E86DE] font-bold">NISN: {text(row.nisn)}</span>
            ) : null}
            {row.komplek || row.kamar ? (
              <span className="font-bold text-[#138F81] bg-[#E8F7F3] px-1.5 py-0.5 rounded">
                🏠 {text(row.komplek)} - {text(row.kamar)}
              </span>
            ) : null}
          </div>
        </div>
      )
    },
    {
      key: 'kelas',
      header: 'Kelas / Madin',
      className: 'w-[130px]',
      render: (row) => (
        <span className={`text-xs font-bold px-2 py-1 rounded-lg inline-block ${row.kelas ? 'bg-[#EAF4FF] text-[#2E86DE]' : 'text-gray-400'}`}>
          {text(row.kelas, 'Belum diatur')}
        </span>
      )
    },
    {
      key: 'wali',
      header: 'Wali / Kontak',
      className: 'w-[160px]',
      render: (row) => {
        const wali = text(row.wali_nama ?? row.nama_wali, '');
        const hp = text(row.no_telepon_wali ?? row.no_whatsapp, '');
        return (
          <div className="text-xs">
            <span className="font-bold text-[#2D3436] block">{wali || '-'}</span>
            {hp && hp !== '-' ? <span className="text-[#636E72] font-mono text-[11px] block">{hp}</span> : null}
          </div>
        );
      }
    },
    {
      key: 'status',
      header: 'Status',
      className: 'w-[125px]',
      render: (row) => (
        <select
          className={`h-7.5 rounded-xl border-0 px-2.5 py-0 text-xs font-extrabold cursor-pointer transition-colors ${
            text(row.status, 'Aktif') === 'Aktif'
              ? 'bg-[#E8F7F3] text-[#138F81] hover:bg-[#d6f5ec]'
              : text(row.status) === 'Lulus'
                ? 'bg-[#EAF4FF] text-[#2E86DE] hover:bg-[#d8ecff]'
                : 'bg-[#FFF3E0] text-[#E8590C] hover:bg-[#ffe6c9]'
          }`}
          value={text(row.status, 'Aktif')}
          onChange={(e) => callbacks.onStatus(row, e.target.value)}
        >
          <option value="Aktif">● Aktif</option>
          <option value="Nonaktif">● Nonaktif</option>
          <option value="Lulus">● Lulus</option>
        </select>
      )
    },
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
