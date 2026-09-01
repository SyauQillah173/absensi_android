import { BookOpen, Pencil, Plus, RefreshCw, Search, Trash2, UsersRound } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { ComplexKelompokForm } from '../components/ComplexKelompokForm';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { DataTable, type DataColumn } from '../components/DataTable';
import { KelompokDetailModal } from '../components/KelompokDetailModal';
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
  const [detailData, setDetailData] = useState<ApiRecord | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<ApiRecord | null>(null);

  async function load() {
    setIsLoading(true);
    setError('');
    try {
      const result = await api.kelompokBelajar();
      const data = Array.isArray(result.data) ? result.data : [];
      setGroups(data);
      setRows(flattenGroups(data));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Kelompok belajar gagal dimuat.');
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  const filtered = useMemo(() => {
    const keyword = search.trim().toLowerCase();
    if (!keyword) return rows;
    return rows.filter((row) => {
      const nama = String(row.nama ?? '').toLowerCase();
      const kategori = String(row.kategori ?? '').toLowerCase();
      const sifir = String(row.sifir ?? '').toLowerCase();
      const pembina = String(record(row.pembina).name ?? row.nama_pembina ?? '').toLowerCase();
      return nama.includes(keyword) || kategori.includes(keyword) || sifir.includes(keyword) || pembina.includes(keyword);
    });
  }, [rows, search]);

  const columns = useMemo<DataColumn<ApiRecord>[]>(
    () => [
      {
        key: 'nama',
        header: 'Nama Kelompok',
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
        render: (row) => (
          <span className="rounded-lg bg-teal-50 border border-teal-200 px-2.5 py-1 text-xs font-black text-teal-800">
            {text(row.kategori)}
          </span>
        ),
      },
      {
        key: 'siswa',
        header: 'Jumlah Santri',
        render: (row) => (
          <span className="font-bold text-slate-700 text-xs">
            👥 {asNumber(row.jumlah_siswa)} santri
          </span>
        ),
      },
      {
        key: 'mapel',
        header: 'Mapel Aktif',
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
              onClick={() => void openDetail(row)}
              type="button"
            >
              Detail
            </button>
            <button
              className="rounded-xl bg-[#EAF4FF] px-3.5 py-2 text-xs font-extrabold text-[#2E86DE] hover:bg-[#d8ecff] transition-colors inline-flex items-center gap-1"
              onClick={() => setActiveFormData(row)}
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

  async function openDetail(row: ApiRecord) {
    const id = asNumber(row.id);
    if (!id) return;
    setError('');
    try {
      const result = await api.kelompokBelajarDetail(id);
      setDetailData(result.data && typeof result.data === 'object' ? (result.data as ApiRecord) : row);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Detail kelompok gagal dimuat.');
    }
  }

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
        onClose={() => setActiveFormData(undefined)}
        onSave={() => {
          setActiveFormData(undefined);
          void load();
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
            onClick={() => setActiveFormData(null)}
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
      <section className="space-y-4 rounded-3xl bg-white p-4 shadow-sm ring-1 ring-black/5">
        <div className="mb-2">
          <SearchInput
            value={search}
            onChange={setSearch}
            placeholder="Cari nama kelompok / kategori / sifir..."
          />
        </div>
        <DataTable
          rows={filtered}
          columns={columns}
          emptyText={isLoading ? 'Memuat kelompok...' : 'Belum ada kelompok belajar.'}
          minWidth="860px"
        />
      </section>

      {/* Detail Modal */}
      {detailData && (
        <KelompokDetailModal
          data={detailData}
          onClose={() => setDetailData(null)}
        />
      )}

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
