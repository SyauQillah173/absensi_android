import { BookOpen, Pencil, Plus, RefreshCw, Search, Trash2, UsersRound } from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { ComplexKelompokForm } from '../components/ComplexKelompokForm';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { DataTable, type DataColumn } from '../components/DataTable';
import { SearchInput } from '../components/SearchInput';
import { StatCard } from '../components/StatCard';
import { api, type ApiRecord } from '../services/api';

function text(value: unknown, fallback = '-'): string {
  const clean = String(value ?? '').trim();
  return clean || fallback;
}

function asNumber(value: unknown): number {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function record(value: unknown): ApiRecord {
  return value && typeof value === 'object' && !Array.isArray(value) ? (value as ApiRecord) : {};
}

function flattenGroups(groups: ApiRecord[]): ApiRecord[] {
  return groups.flatMap((group) => {
    const kelas = Array.isArray(group.kelas) ? group.kelas : [];
    return kelas.map((item) => ({
      ...(item as ApiRecord),
      kategori: group.kategori ?? (item as ApiRecord).kategori,
    }));
  });
}

export function KelompokBelajarPage() {
  const [groups, setGroups] = useState<ApiRecord[]>([]);
  const [rows, setRows] = useState<ApiRecord[]>([]);
  const [search, setSearch] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isDeleting, setIsDeleting] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  // Modals & Forms state
  const [activeFormData, setActiveFormData] = useState<ApiRecord | null | undefined>(undefined);
  const [isReadOnlyForm, setIsReadOnlyForm] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<ApiRecord | null>(null);

  // Status Filter: semua / ada santri / belum terisi
  const [filterStatus, setFilterStatus] = useState<'all' | 'filled' | 'empty'>('all');


  const load = useCallback(async (silent = false) => {
    if (!silent) setIsLoading(true);
    setError('');
    try {
      const result = await api.kelompokBelajar();
      const data = Array.isArray(result.data) ? result.data : [];
      setGroups(data);
      setRows(flattenGroups(data));
    } catch (err) {
      if (!silent) setError(err instanceof Error ? err.message : 'Kelompok belajar gagal dimuat.');
    } finally {
      if (!silent) setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();

    // 1. Auto-refresh saat event app:data-updated dipicu
    const handleDataUpdate = (e: Event) => {
      const customEvt = e as CustomEvent;
      if (!customEvt.detail || customEvt.detail.type === 'kelompok' || customEvt.detail.type === 'all') {
        void load(true);
      }
    };
    window.addEventListener('app:data-updated', handleDataUpdate);

    // 2. Auto-refresh saat tab/layar kembali aktif (window focus & visibility change)
    const handleFocus = () => {
      void load(true);
    };
    window.addEventListener('focus', handleFocus);
    const handleVisibility = () => {
      if (document.visibilityState === 'visible') {
        void load(true);
      }
    };
    document.addEventListener('visibilitychange', handleVisibility);

    // 3. Periodic Background Auto-Refresh cerdas (setiap 15 detik saat tab aktif)
    const interval = setInterval(() => {
      if (document.visibilityState === 'visible' && activeFormData === undefined) {
        void load(true);
      }
    }, 15000);

    return () => {
      window.removeEventListener('app:data-updated', handleDataUpdate);
      window.removeEventListener('focus', handleFocus);
      document.removeEventListener('visibilitychange', handleVisibility);
      clearInterval(interval);
    };
  }, [load, activeFormData]);


  const filledCount = useMemo(() => rows.filter(r => asNumber(r.jumlah_siswa) > 0).length, [rows]);
  const emptyCount = useMemo(() => rows.filter(r => asNumber(r.jumlah_siswa) === 0).length, [rows]);

  const filtered = useMemo(() => {
    let result = rows;

    if (filterStatus === 'filled') {
      result = result.filter((row) => asNumber(row.jumlah_siswa) > 0);
    } else if (filterStatus === 'empty') {
      result = result.filter((row) => asNumber(row.jumlah_siswa) === 0);
    }

    const keyword = search.trim().toLowerCase();
    if (!keyword) return result;

    return result.filter((row) => {
      const nama = String(row.nama ?? '').toLowerCase();
      const kategori = String(row.kategori ?? '').toLowerCase();
      const sifir = String(row.sifir ?? '').toLowerCase();
      const pembina = String(record(row.pembina).name ?? row.nama_pembina ?? '').toLowerCase();
      return (
        nama.includes(keyword) ||
        kategori.includes(keyword) ||
        sifir.includes(keyword) ||
        pembina.includes(keyword)
      );
    });
  }, [rows, search, filterStatus]);


  const openDetail = (row: ApiRecord) => {
    setActiveFormData(row);
    setIsReadOnlyForm(true);
  };

  const openEdit = (row: ApiRecord) => {
    setActiveFormData(row);
    setIsReadOnlyForm(false);
  };

  const openCreate = () => {
    setActiveFormData(null);
    setIsReadOnlyForm(false);
  };

  const columns = useMemo<DataColumn<ApiRecord>[]>(
    () => [
      {
        key: 'nama',
        header: 'Nama Kelompok',
        sortable: true,
        sortValue: (row) => String(row.nama ?? ''),
        render: (row) => (
          <div>
            <span className="font-extrabold text-slate-800 text-sm block">{text(row.nama)}</span>
            <span className="text-[11px] font-bold text-slate-400 mt-0.5 inline-block">
              Sifir / Level: {text(row.sifir)}
            </span>
          </div>
        ),
      },
      {
        key: 'kategori',
        header: 'Kategori',
        sortable: true,
        sortValue: (row) => String(row.kategori ?? ''),
        render: (row) => (
          <span className="rounded-lg bg-teal-50 border border-teal-200 px-2.5 py-1 text-xs font-black text-teal-800 whitespace-nowrap">
            {text(row.kategori)}
          </span>
        ),
      },
      {
        key: 'jumlah_siswa',
        header: 'Jumlah Santri',
        sortable: true,
        sortValue: (row) => asNumber(row.jumlah_siswa),
        render: (row) => {
          const count = asNumber(row.jumlah_siswa);
          return (
            <span
              className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-xl text-xs font-black ${
                count > 0
                  ? 'bg-emerald-100/90 text-emerald-800 border border-emerald-300 ring-2 ring-emerald-500/20 shadow-xs'
                  : 'bg-slate-100 text-slate-400 border border-slate-200'
              }`}
            >
              👥 {count} santri
            </span>
          );
        },
      },
      {
        key: 'jumlah_mapel_aktif',
        header: 'Mapel Aktif',
        sortable: true,
        sortValue: (row) => asNumber(row.jumlah_mapel_aktif),
        render: (row) => (
          <span className="font-bold text-slate-700 text-xs">
            📖 {asNumber(row.jumlah_mapel_aktif)} mapel
          </span>
        ),
      },
      {
        key: 'aksi',
        header: 'Aksi',
        render: (row) => (
          <div className="flex flex-wrap gap-2">
            <button
              className="rounded-xl bg-[#E8F7F3] px-3.5 py-2 text-xs font-extrabold text-[#138F81] hover:bg-[#d0f2e9] transition-colors"
              onClick={() => openDetail(row)}
              type="button"
            >
              Detail
            </button>
            <button
              className="rounded-xl bg-[#EAF4FF] px-3.5 py-2 text-xs font-extrabold text-[#2E86DE] hover:bg-[#d8ecff] transition-colors inline-flex items-center gap-1"
              onClick={() => openEdit(row)}
              type="button"
            >
              <Pencil size={13} /> Edit
            </button>
            <button
              className="rounded-xl bg-[#FDECEC] px-3 py-2 text-xs font-extrabold text-[#D63031] hover:bg-[#fad4d4] transition-colors inline-flex items-center gap-1"
              onClick={() => setDeleteTarget(row)}
              type="button"
            >
              <Trash2 size={13} /> Hapus
            </button>
          </div>
        ),
      },
    ],
    []
  );

  async function handleDelete() {
    if (!deleteTarget?.id || isDeleting) return;
    setIsDeleting(true);
    setError('');
    try {
      await api.deleteKelompokBelajar(asNumber(deleteTarget.id));
      setDeleteTarget(null);
      setNotice('Kelompok belajar berhasil dihapus.');
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Kelompok gagal dihapus.');
    } finally {
      setIsDeleting(false);
    }
  }

  // Jika form aktif terbuka, tampilkan ComplexKelompokForm
  if (activeFormData !== undefined) {
    return (
      <ComplexKelompokForm
        initialData={activeFormData}
        readOnly={isReadOnlyForm}
        onClose={() => {
          setActiveFormData(undefined);
          setIsReadOnlyForm(false);
          void load(true);
        }}
        onSave={() => {
          setActiveFormData(undefined);
          setIsReadOnlyForm(false);
          void load(true);
        }}

      />
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <section className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm font-bold text-[#636E72]">Akademik & KBM</p>
          <h1 className="text-3xl font-extrabold text-[#2D3436]">Kelompok Belajar</h1>
          <p className="text-sm font-semibold text-[#636E72]">
            Kelola kelompok sifir/kelas dan manajemen santri secara terpadu.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            className="q-refresh-button inline-flex min-h-11 items-center gap-2 rounded-2xl bg-white px-4 text-sm font-bold text-[#138F81]"
            onClick={() => void load()}
            type="button"
            disabled={isLoading}
          >
            <RefreshCw className={`q-refresh-icon ${isLoading ? 'animate-spin' : ''}`} size={17} /> Refresh
          </button>
          <button
            className="q-soft-action inline-flex min-h-11 items-center gap-2 rounded-2xl bg-[#138F81] px-4 text-sm font-extrabold text-white shadow-md shadow-[#138F81]/25 hover:bg-[#0f766a] transition-all"
            onClick={openCreate}
            type="button"
          >
            <Plus size={17} /> Tambah Kelompok
          </button>
        </div>
      </section>

      {notice && (
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50/90 p-4 text-sm font-bold text-emerald-800 animate-in fade-in duration-300">
          ✅ {notice}
        </div>
      )}

      {error && (
        <div className="rounded-2xl border border-rose-200 bg-rose-50/90 p-4 text-sm font-bold text-rose-700">
          ⚠️ {error}
        </div>
      )}

      {/* Stat Cards */}
      <div className="grid gap-4 md:grid-cols-3">
        <StatCard
          title="Total Kelompok"
          value={rows.length}
          subtitle={`${groups.length} kategori kelompok`}
          icon={BookOpen}
          tone="teal"
        />
        <StatCard
          title="Total Santri Terdaftar"
          value={rows.reduce((sum, row) => sum + asNumber(row.jumlah_siswa), 0)}
          subtitle="Santri aktif dalam kelompok"
          icon={UsersRound}
          tone="blue"
        />
        <StatCard
          title="Mapel Aktif"
          value={rows.reduce((sum, row) => sum + asNumber(row.jumlah_mapel_aktif), 0)}
          subtitle="Terhubung ke jadwal KBM"
          icon={Search}
          tone="orange"
        />
      </div>

      {/* Filter & Table */}
      <section className="space-y-4 rounded-3xl bg-white p-4 sm:p-6 shadow-sm ring-1 ring-black/5">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div className="flex-1 min-w-[260px]">
            <SearchInput
              value={search}
              onChange={setSearch}
              placeholder="Cari nama kelompok / kategori / sifir..."
            />
          </div>

          {/* Quick Filter Status Santri */}
          <div className="inline-flex items-center gap-1 p-1 bg-slate-100 rounded-2xl border border-slate-200 shrink-0 self-start md:self-auto">
            <button
              type="button"
              onClick={() => setFilterStatus('all')}
              className={`px-3 py-1.5 rounded-xl text-xs font-extrabold transition-all ${
                filterStatus === 'all'
                  ? 'bg-white text-slate-800 shadow-xs ring-1 ring-black/5'
                  : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              Semua ({rows.length})
            </button>
            <button
              type="button"
              onClick={() => setFilterStatus('filled')}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-extrabold transition-all ${
                filterStatus === 'filled'
                  ? 'bg-[#138F81] text-white shadow-xs'
                  : 'text-slate-600 hover:text-[#138F81]'
              }`}
              title="Tampilkan hanya kelompok yang ada santrinya"
            >
              <span className={`h-2 w-2 rounded-full ${filterStatus === 'filled' ? 'bg-white' : 'bg-emerald-500'}`} />
              Ada Santri ({filledCount})
            </button>
            <button
              type="button"
              onClick={() => setFilterStatus('empty')}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-extrabold transition-all ${
                filterStatus === 'empty'
                  ? 'bg-slate-700 text-white shadow-xs'
                  : 'text-slate-500 hover:text-slate-700'
              }`}
              title="Tampilkan kelompok yang belum terisi / masih kosong"
            >
              <span className={`h-2 w-2 rounded-full ${filterStatus === 'empty' ? 'bg-white' : 'bg-slate-400'}`} />
              Belum Terisi ({emptyCount})
            </button>
          </div>
        </div>

        <DataTable
          rows={filtered}
          columns={columns}
          emptyText={
            isLoading
              ? 'Memuat kelompok...'
              : filterStatus === 'filled'
              ? 'Tidak ada kelompok belajar yang terisi santri.'
              : filterStatus === 'empty'
              ? 'Seluruh kelompok belajar sudah terisi santri.'
              : 'Belum ada kelompok belajar.'
          }
          minWidth="860px"
          mobileRender={(row) => (
            <article className="rounded-2xl border border-slate-200 bg-white p-4 shadow-xs space-y-3">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <p className="text-base font-black text-slate-800 leading-snug">{text(row.nama)}</p>
                  <p className="text-xs font-bold text-slate-400 mt-0.5">Sifir / Level: {text(row.sifir)}</p>
                </div>
                <span className="shrink-0 rounded-lg bg-teal-50 border border-teal-200 px-2.5 py-1 text-xs font-black text-teal-800 whitespace-nowrap">
                  {text(row.kategori)}
                </span>
              </div>

              <div className="grid grid-cols-2 gap-2 pt-2 border-t border-slate-100 text-xs font-bold text-slate-600">
                <div className="rounded-xl bg-slate-50 p-2 border border-slate-100 flex items-center gap-1.5">
                  <span>👥 {asNumber(row.jumlah_siswa)} Santri</span>
                </div>
                <div className="rounded-xl bg-slate-50 p-2 border border-slate-100 flex items-center gap-1.5">
                  <span>📖 {asNumber(row.jumlah_mapel_aktif)} Mapel</span>
                </div>
              </div>

              <div className="flex items-center gap-2 pt-1 border-t border-slate-100">
                <button
                  className="flex-1 rounded-xl bg-[#E8F7F3] py-2 text-xs font-extrabold text-[#138F81] hover:bg-[#d0f2e9] transition-colors text-center"
                  onClick={() => openDetail(row)}
                  type="button"
                >
                  Detail
                </button>
                <button
                  className="flex-1 rounded-xl bg-[#EAF4FF] py-2 text-xs font-extrabold text-[#2E86DE] hover:bg-[#d8ecff] transition-colors inline-flex items-center justify-center gap-1"
                  onClick={() => openEdit(row)}
                  type="button"
                >
                  <Pencil size={13} /> Edit
                </button>
                <button
                  className="rounded-xl bg-[#FDECEC] px-3 py-2 text-xs font-extrabold text-[#D63031] hover:bg-[#fad4d4] transition-colors inline-flex items-center justify-center"
                  onClick={() => setDeleteTarget(row)}
                  type="button"
                  title="Hapus"
                >
                  <Trash2 size={13} />
                </button>
              </div>
            </article>
          )}
        />
      </section>

      {/* Delete Confirmation */}
      {deleteTarget && (
        <ConfirmDialog
          title="Hapus Kelompok Belajar?"
          message={`Apakah Anda yakin ingin menghapus kelompok "${text(deleteTarget?.nama)}"?`}
          confirmLabel={isDeleting ? 'Menghapus...' : 'Ya, Hapus'}
          tone="danger"
          isBusy={isDeleting}
          onConfirm={() => void handleDelete()}
          onCancel={() => setDeleteTarget(null)}
        />
      )}
    </div>
  );
}
