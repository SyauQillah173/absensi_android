import { BookOpen, Calendar, GraduationCap, Pencil, Plus, RefreshCw, Search, Trash2, UsersRound } from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { ComplexMapelForm } from '../components/ComplexMapelForm';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { DataTable, type DataColumn } from '../components/DataTable';
import { SearchInput } from '../components/SearchInput';
import { StatCard } from '../components/StatCard';
import { StatusBadge } from '../components/StatusBadge';
import { api, type ApiRecord } from '../services/api';

function text(value: unknown, fallback = '-'): string {
  const clean = String(value ?? '').trim();
  return clean || fallback;
}

function num(value: unknown): number {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function list(value: unknown): ApiRecord[] {
  return Array.isArray(value) ? (value as ApiRecord[]) : [];
}

function formatTime(val: unknown): string {
  const str = String(val ?? '').trim();
  if (str.length >= 5) return str.slice(0, 5);
  return str;
}

function CompactJadwalCell({ jadwals }: { jadwals: ApiRecord[] }) {
  const [isExpanded, setIsExpanded] = useState(false);

  if (!jadwals.length) {
    return <span className="text-xs font-semibold text-slate-400 italic">Belum ada jadwal</span>;
  }

  const renderItem = (j: ApiRecord, idx: number) => {
    const hari = text(j.hari);
    const jamMulai = formatTime(j.jam_mulai);
    const jamSelesai = formatTime(j.jam_selesai);
    const sifir = text(j.sifir ?? (j.class as ApiRecord)?.name);

    return (
      <span
        key={idx}
        className="inline-flex items-center gap-1 rounded-lg bg-teal-50/90 border border-teal-200/80 px-2 py-0.5 text-[11px] font-bold text-teal-900 shadow-xs"
      >
        <span className="font-extrabold text-[#138F81]">{hari}</span>
        <span className="text-slate-600 font-mono text-[10px]">({jamMulai}-{jamSelesai})</span>
        <span className="text-slate-700">• {sifir}</span>
      </span>
    );
  };

  if (jadwals.length <= 2) {
    return (
      <div className="flex flex-wrap gap-1.5 max-w-sm">
        {jadwals.map(renderItem)}
      </div>
    );
  }

  return (
    <div className="space-y-1.5 max-w-sm">
      <div className="flex flex-wrap items-center gap-1.5">
        {isExpanded ? jadwals.map(renderItem) : jadwals.slice(0, 2).map(renderItem)}
        
        <button
          type="button"
          onClick={() => setIsExpanded((prev) => !prev)}
          className="inline-flex items-center gap-1 rounded-lg bg-teal-100/80 hover:bg-teal-200 text-teal-900 px-2 py-0.5 text-[10px] font-black transition-colors cursor-pointer"
        >
          {isExpanded ? '▲ Ringkas' : `+${jadwals.length - 2} Lainnya...`}
        </button>
      </div>
    </div>
  );
}

export function MataPelajaranPage() {
  const [rows, setRows] = useState<ApiRecord[]>([]);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('Semua');
  const [jadwalFilter, setJadwalFilter] = useState<'all' | 'has_jadwal' | 'no_jadwal'>('all');
  const [activeFormData, setActiveFormData] = useState<ApiRecord | null | undefined>(undefined);
  const [deleteTarget, setDeleteTarget] = useState<ApiRecord | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isDeleting, setIsDeleting] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const load = useCallback(async (silent = false) => {
    if (!silent) setIsLoading(true);
    setError('');
    try {
      const mapelResult = await api.mataPelajaran({
        status: statusFilter === 'Semua' ? '' : statusFilter,
      });
      setRows(Array.isArray(mapelResult.data) ? mapelResult.data : []);
    } catch (err) {
      if (!silent) setError(err instanceof Error ? err.message : 'Mata pelajaran gagal dimuat.');
    } finally {
      if (!silent) setIsLoading(false);
    }
  }, [statusFilter]);

  useEffect(() => {
    void load();

    // 1. Auto-refresh saat event app:data-updated dipicu
    const handleDataUpdate = (e: Event) => {
      const customEvt = e as CustomEvent;
      if (!customEvt.detail || customEvt.detail.type === 'mapel' || customEvt.detail.type === 'all') {
        void load(true);
      }
    };
    window.addEventListener('app:data-updated', handleDataUpdate);

    // 2. Auto-refresh saat window fokus atau tab kembali aktif
    const handleFocus = () => void load(true);
    window.addEventListener('focus', handleFocus);
    const handleVisibility = () => {
      if (document.visibilityState === 'visible') void load(true);
    };
    document.addEventListener('visibilitychange', handleVisibility);

    // 3. Periodic Background Auto-Refresh (setiap 60 detik)
    const interval = setInterval(() => {
      if (document.visibilityState === 'visible' && activeFormData === undefined) {
        void load(true);
      }
    }, 60000);

    return () => {
      window.removeEventListener('app:data-updated', handleDataUpdate);
      window.removeEventListener('focus', handleFocus);
      document.removeEventListener('visibilitychange', handleVisibility);
      clearInterval(interval);
    };
  }, [load, activeFormData]);

  const hasJadwalCount = useMemo(() => rows.filter((r) => list(r.jadwal).length > 0).length, [rows]);
  const noJadwalCount = useMemo(() => rows.filter((r) => list(r.jadwal).length === 0).length, [rows]);

  const filtered = useMemo(() => {
    let result = rows;

    if (jadwalFilter === 'has_jadwal') {
      result = result.filter((row) => list(row.jadwal).length > 0);
    } else if (jadwalFilter === 'no_jadwal') {
      result = result.filter((row) => list(row.jadwal).length === 0);
    }

    const keyword = search.toLowerCase();
    if (!keyword) return result;
    return result.filter((row) => {
      const guruNames = list(row.guru).map((guru) => guru.name).join(' ');
      const jadwalDetails = list(row.jadwal).map((j) => `${j.hari ?? ''} ${j.sifir ?? ''} ${j.ruangan ?? ''}`).join(' ');
      return `${row.nama ?? ''} ${row.kode ?? ''} ${guruNames} ${jadwalDetails}`.toLowerCase().includes(keyword);
    });
  }, [rows, search, jadwalFilter]);


  const totalJadwals = useMemo(() => {
    return rows.reduce((sum, row) => sum + list(row.jadwal).length, 0);
  }, [rows]);

  const totalTeachers = useMemo(() => {
    const teacherIdSet = new Set<number>();
    rows.forEach((row) => {
      list(row.guru).forEach((g) => {
        if (g.id) teacherIdSet.add(num(g.id));
      });
    });
    return teacherIdSet.size;
  }, [rows]);

  const columns = useMemo<DataColumn<ApiRecord>[]>(
    () => [
      {
        key: 'nama',
        header: 'Mata Pelajaran',
        sortable: true,
        sortValue: (row) => String(row.nama ?? ''),
        render: (row) => (
          <div>
            <span className="font-extrabold text-slate-800 text-sm block">{text(row.nama)}</span>
            {row.kode ? (
              <span className="text-[11px] font-bold text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded mt-0.5 inline-block">
                Kode: {text(row.kode)}
              </span>
            ) : null}
          </div>
        ),
      },
      {
        key: 'guru',
        header: 'Guru Pengajar',
        sortable: true,
        sortValue: (row) => list(row.guru).length,
        render: (row) => {
          const gurus = list(row.guru);
          if (!gurus.length) {
            return <span className="text-xs font-semibold text-slate-400 italic">Belum terhubung</span>;
          }
          return (
            <div className="flex flex-wrap gap-1.5 max-w-xs">
              {gurus.map((g, idx) => (
                <span
                  key={idx}
                  className="rounded-lg bg-emerald-50 border border-emerald-200 px-2 py-0.5 text-[11px] font-bold text-emerald-800"
                >
                  {text(g.name)}
                </span>
              ))}
            </div>
          );
        },
      },
      {
        key: 'jadwal',
        header: 'Susunan Jadwal KBM',
        sortable: true,
        sortValue: (row) => list(row.jadwal).length,
        render: (row) => <CompactJadwalCell jadwals={list(row.jadwal)} />,
      },
      {
        key: 'status',
        header: 'Status',
        sortable: true,
        sortValue: (row) => String(row.status ?? ''),
        render: (row) => (
          <StatusBadge
            label={text(row.status, 'Aktif')}
            tone={text(row.status) === 'Aktif' ? 'success' : 'danger'}
          />
        ),
      },

      {
        key: 'aksi',
        header: 'Aksi',
        render: (row) => (
          <div className="flex flex-wrap gap-2">
            <button
              className="rounded-xl bg-[#EAF4FF] px-3.5 py-2 text-xs font-extrabold text-[#2E86DE] hover:bg-[#d8ecff] transition-colors inline-flex items-center gap-1.5"
              onClick={() => setActiveFormData(row)}
              type="button"
            >
              <Pencil size={13} /> Edit & Atur Jadwal
            </button>
            <button
              className="rounded-xl bg-[#FDECEC] px-3 py-2 text-xs font-extrabold text-[#D63031] hover:bg-[#fad4d4] transition-colors inline-flex items-center gap-1.5"
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
      await api.deleteMataPelajaran(num(deleteTarget.id));
      setDeleteTarget(null);
      setNotice('Mata pelajaran dan seluruh jadwal terkait berhasil dihapus.');
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Mata pelajaran gagal dihapus.');
    } finally {
      setIsDeleting(false);
    }
  }

  // Jika form aktif terbuka, tampilkan ComplexMapelForm
  if (activeFormData !== undefined) {
    return (
      <ComplexMapelForm
        initialData={activeFormData}
        onClose={() => {
          setActiveFormData(undefined);
          void load(true);
        }}
        onSave={() => {
          setActiveFormData(undefined);
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
          <h1 className="text-3xl font-extrabold text-[#2D3436]">Mata Pelajaran & Jadwal KBM</h1>
          <p className="text-sm font-semibold text-[#636E72]">
            Kelola mata pelajaran resmi, guru pengajar, dan susunan jam jadwal santri secara terpadu.
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
            <Plus size={17} /> Tambah Mapel & Jadwal
          </button>
        </div>
      </section>

      {/* Stat Cards */}
      <section className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard
          title="Total Mata Pelajaran"
          value={rows.length}
          subtitle={`${rows.filter((r) => text(r.status) === 'Aktif').length} berstatus aktif`}
          icon={BookOpen}
          tone="teal"
        />
        <StatCard
          title="Total Slot Jadwal"
          value={totalJadwals}
          subtitle="Jadwal aktif KBM santri"
          icon={Calendar}
          tone="blue"
        />
        <StatCard
          title="Guru Pengajar Terhubung"
          value={totalTeachers}
          subtitle="Ustadz / Ustadzah terdaftar"
          icon={GraduationCap}
          tone="teal"
        />
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

      {/* Filters & Search */}
      <section className="space-y-4 rounded-3xl bg-white p-4 sm:p-6 shadow-sm ring-1 ring-black/5">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div className="flex-1 min-w-[260px]">
            <SearchInput
              value={search}
              onChange={setSearch}
              placeholder="Cari nama mapel / kode / guru / hari / kelas..."
            />
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* Quick Filter: Mana yang ada jadwal vs belum ada jadwal */}
            <div className="inline-flex items-center gap-1 p-1 bg-slate-100 rounded-2xl border border-slate-200 shrink-0">
              <button
                type="button"
                onClick={() => setJadwalFilter('all')}
                className={`px-3 py-1.5 rounded-xl text-xs font-extrabold transition-all ${
                  jadwalFilter === 'all'
                    ? 'bg-white text-slate-800 shadow-xs ring-1 ring-black/5'
                    : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                Semua ({rows.length})
              </button>
              <button
                type="button"
                onClick={() => setJadwalFilter('has_jadwal')}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-extrabold transition-all ${
                  jadwalFilter === 'has_jadwal'
                    ? 'bg-[#138F81] text-white shadow-xs'
                    : 'text-slate-600 hover:text-[#138F81]'
                }`}
                title="Tampilkan hanya mapel yang sudah memiliki slot jadwal KBM"
              >
                <span className={`h-2 w-2 rounded-full ${jadwalFilter === 'has_jadwal' ? 'bg-white' : 'bg-emerald-500'}`} />
                Ada Jadwal ({hasJadwalCount})
              </button>
              <button
                type="button"
                onClick={() => setJadwalFilter('no_jadwal')}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-extrabold transition-all ${
                  jadwalFilter === 'no_jadwal'
                    ? 'bg-slate-700 text-white shadow-xs'
                    : 'text-slate-500 hover:text-slate-700'
                }`}
                title="Tampilkan mapel yang belum memiliki jadwal KBM"
              >
                <span className={`h-2 w-2 rounded-full ${jadwalFilter === 'no_jadwal' ? 'bg-white' : 'bg-slate-400'}`} />
                Belum Ada Jadwal ({noJadwalCount})
              </button>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <select
                className="rounded-2xl border border-slate-200 bg-white px-3 py-2 text-xs font-extrabold text-slate-700 outline-none focus:border-[#138F81] cursor-pointer"
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
              >
                <option value="Semua">Semua Status</option>
                <option value="Aktif">Aktif</option>
                <option value="Nonaktif">Nonaktif</option>
              </select>
            </div>
          </div>
        </div>

        <DataTable
          rows={filtered}
          columns={columns}
          defaultSortKey="jadwal"
          defaultSortDirection="desc"
          emptyText={
            isLoading
              ? 'Memuat mata pelajaran & jadwal...'
              : jadwalFilter === 'has_jadwal'
              ? 'Tidak ada mata pelajaran yang memiliki jadwal.'
              : jadwalFilter === 'no_jadwal'
              ? 'Seluruh mata pelajaran sudah memiliki jadwal KBM.'
              : 'Belum ada mata pelajaran.'
          }
          minWidth="880px"
        />
      </section>


      {deleteTarget && (
        <ConfirmDialog
          title="Hapus Mata Pelajaran & Jadwal?"
          message={`Apakah Anda yakin ingin menghapus "${text(deleteTarget?.nama)}"? Seluruh slot jadwal KBM yang terhubung ke mapel ini juga akan terhapus.`}
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
