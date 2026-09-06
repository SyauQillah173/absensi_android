import {
  BookOpen,
  CheckCircle2,
  GraduationCap,
  Pencil,
  Plus,
  RefreshCw,
  Sparkles,
  Trash2,
  Users,
  X,
} from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { ComplexKelasForm } from '../components/ComplexKelasForm';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { DataTable, type DataColumn } from '../components/DataTable';
import { SearchInput } from '../components/SearchInput';
import { api, type ApiRecord } from '../services/api';

export function MasterKelasPage() {
  const [classes, setClasses] = useState<ApiRecord[]>([]);
  const [search, setSearch] = useState('');
  const [genderFilter, setGenderFilter] = useState<'all' | 'PA' | 'PI' | 'Campur'>('all');
  const [santriFilter, setSantriFilter] = useState<'all' | 'has_santri' | 'no_santri'>('all');
  const [form, setForm] = useState<ApiRecord | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<ApiRecord | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const load = useCallback(async (silent = false) => {
    if (!silent) setIsLoading(true);
    setError('');
    try {
      const result = await api.classes();
      const raw = Array.isArray(result.data) ? result.data : [];
      // Filter classes to only include Madin / Diniyah
      const madinOnly = raw.filter(
        (c) =>
          String(c.category || '').toLowerCase() !== 'formal' ||
          String(c.name || '').toLowerCase().startsWith('sifir') ||
          String(c.name || '').toLowerCase().includes('ibtidaiyah') ||
          String(c.name || '').toLowerCase().includes('tsanawiyah') ||
          String(c.name || '').toLowerCase().includes('aliyah')
      );
      setClasses(madinOnly.length > 0 ? madinOnly : raw);
    } catch (err) {
      if (!silent) setError(err instanceof Error ? err.message : 'Data kelas Madin gagal dimuat');
    } finally {
      if (!silent) setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();

    // 1. Auto-refresh saat event app:data-updated dipicu
    const handleDataUpdate = (e: Event) => {
      const customEvt = e as CustomEvent;
      if (!customEvt.detail || customEvt.detail.type === 'kelas' || customEvt.detail.type === 'all') {
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
      if (document.visibilityState === 'visible' && form === null) {
        void load(true);
      }
    }, 60000);

    return () => {
      window.removeEventListener('app:data-updated', handleDataUpdate);
      window.removeEventListener('focus', handleFocus);
      document.removeEventListener('visibilitychange', handleVisibility);
      clearInterval(interval);
    };
  }, [load, form]);

  const totalPa = useMemo(() => {
    return classes.filter((c) => String(c.gender_group || '').toUpperCase() === 'PA').length;
  }, [classes]);

  const totalPi = useMemo(() => {
    return classes.filter((c) => String(c.gender_group || '').toUpperCase() === 'PI').length;
  }, [classes]);

  const totalCampur = useMemo(() => {
    return classes.filter((c) => {
      const g = String(c.gender_group || '').toUpperCase();
      return g === 'CAMPUR' || (g !== 'PA' && g !== 'PI');
    }).length;
  }, [classes]);

  const totalSiswa = useMemo(() => {
    return classes.reduce((sum, c) => sum + Number(c.siswa_count ?? 0), 0);
  }, [classes]);

  const hasSantriCount = useMemo(() => {
    return classes.filter((c) => Number(c.siswa_count ?? 0) > 0).length;
  }, [classes]);

  const noSantriCount = useMemo(() => {
    return classes.filter((c) => Number(c.siswa_count ?? 0) === 0).length;
  }, [classes]);

  const filtered = useMemo(() => {
    const keyword = search.trim().toLowerCase();
    return classes.filter((row) => {
      if (genderFilter !== 'all') {
        const rowGender = String(row.gender_group || '').toUpperCase();
        if (genderFilter === 'PA' && rowGender !== 'PA') return false;
        if (genderFilter === 'PI' && rowGender !== 'PI') return false;
        if (genderFilter === 'Campur' && rowGender !== 'CAMPUR' && rowGender !== '') return false;
      }

      if (santriFilter === 'has_santri' && Number(row.siswa_count ?? 0) === 0) return false;
      if (santriFilter === 'no_santri' && Number(row.siswa_count ?? 0) > 0) return false;

      if (!keyword) return true;
      const name = String(row.name ?? '').toLowerCase();
      const code = String(row.code ?? '').toLowerCase();
      return name.includes(keyword) || code.includes(keyword);
    });
  }, [classes, search, genderFilter, santriFilter]);


  const columns: DataColumn<ApiRecord>[] = [
    {
      key: 'name',
      header: 'Nama Kelas Madin',
      sortable: true,
      sortValue: (row) => String(row.name ?? ''),
      render: (row) => (
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-teal-50 text-[#138F81] font-black text-sm border border-teal-100 shadow-xs">
            <BookOpen size={18} />
          </div>
          <div>
            <p className="font-extrabold text-slate-800 text-sm">{String(row.name)}</p>
            <p className="text-[11px] font-mono text-slate-400">Kode: {String(row.code || '-')}</p>
          </div>
        </div>
      ),
    },
    {
      key: 'gender_group',
      header: 'Kelompok Santri',
      sortable: true,
      sortValue: (row) => String(row.gender_group ?? ''),
      render: (row) => {
        const g = String(row.gender_group || '').toUpperCase();
        if (g === 'PA') {
          return (
            <span className="inline-flex items-center gap-1.5 rounded-xl bg-blue-50 px-3 py-1 text-xs font-extrabold text-blue-700 border border-blue-200/60">
              👦 Putra (PA)
            </span>
          );
        }
        if (g === 'PI') {
          return (
            <span className="inline-flex items-center gap-1.5 rounded-xl bg-rose-50 px-3 py-1 text-xs font-extrabold text-rose-700 border border-rose-200/60">
              👧 Putri (PI)
            </span>
          );
        }
        return (
          <span className="inline-flex items-center gap-1.5 rounded-xl bg-slate-100 px-3 py-1 text-xs font-extrabold text-slate-600 border border-slate-200/60">
            👥 Campur / Umum
          </span>
        );
      },
    },
    {
      key: 'siswa_count',
      header: 'Jumlah Santri',
      sortable: true,
      sortValue: (row) => Number(row.siswa_count ?? 0),
      render: (row) => {
        const count = Number(row.siswa_count ?? 0);
        return (
          <span
            className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-xl text-xs font-extrabold ${
              count > 0
                ? 'bg-teal-50 text-teal-800 border border-teal-200/60'
                : 'bg-slate-50 text-slate-400 border border-slate-200/40'
            }`}
          >
            <Users size={14} /> {count} Santri
          </span>
        );
      },
    },
    {
      key: 'is_active',
      header: 'Status',
      sortable: true,
      sortValue: (row) => (row.is_active !== false ? 1 : 0),
      render: (row) => (
        <span
          className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-extrabold ${
            row.is_active !== false
              ? 'bg-emerald-100 text-emerald-800'
              : 'bg-slate-100 text-slate-500'
          }`}
        >
          <span className={`h-2 w-2 rounded-full ${row.is_active !== false ? 'bg-emerald-500' : 'bg-slate-400'}`} />
          {row.is_active !== false ? 'Aktif' : 'Nonaktif'}
        </span>
      ),
    },
    {
      key: 'actions',
      header: 'Aksi',
      render: (row) => (
        <div className="flex justify-end gap-2">
          <button
            className="rounded-xl bg-[#EAF4FF] px-3.5 py-2 text-xs font-extrabold text-[#2E86DE] hover:bg-[#d8ecff] transition-colors inline-flex items-center gap-1.5"
            onClick={() => setForm(row)}
            type="button"
          >
            <Pencil size={13} /> Edit Kelas
          </button>
          <button
            className="rounded-xl bg-[#FDECEC] px-3.5 py-2 text-xs font-extrabold text-[#D63031] hover:bg-[#fad4d4] transition-colors inline-flex items-center gap-1.5"
            onClick={() => setDeleteTarget(row)}
            type="button"
          >
            <Trash2 size={13} /> Hapus
          </button>
        </div>
      ),
    },
  ];


  async function deleteRecord() {
    if (!deleteTarget?.id || isSaving) return;
    setIsSaving(true);
    setError('');
    try {
      await api.deleteClass(Number(deleteTarget.id));
      window.dispatchEvent(new CustomEvent('app:data-updated', { detail: { type: 'kelas' } }));
      setDeleteTarget(null);
      setNotice('Data kelas berhasil diproses.');
      await load(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Gagal memproses data kelas.');
    } finally {
      setIsSaving(false);
    }
  }

  // JIKA FORM AKTIF TERBUKA, TAMPILKAN COMPLEX KELAS FORM (IN-PAGE FORM PERSIS FORM SANTRI)
  if (form !== null) {

    return (
      <ComplexKelasForm
        initialData={form.id ? form : null}
        onClose={() => {
          setForm(null);
          void load(true);
        }}
        onSave={() => {
          setForm(null);
          void load(true);
        }}
      />
    );
  }

  return (
    <div className="space-y-6">

      {/* 🌟 HEADER CARD KELAS MADIN */}
      <div className="q-card flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-5 sm:p-6 rounded-3xl bg-white border border-slate-200/80 shadow-sm">
        <div className="flex items-center gap-4">
          <div className="h-12 w-12 sm:h-14 sm:w-14 rounded-2xl bg-[#E1EFF7] text-[#138F81] border border-teal-100 flex items-center justify-center shrink-0 shadow-xs">
            <GraduationCap className="w-6 h-6 sm:w-7 sm:h-7" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-[11px] font-bold uppercase tracking-wider text-[#636E72]">
                Akademik & KBM
              </span>
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black bg-[#E8F7F3] text-[#138F81] border border-[#138F81]/20">
                Madrasah Diniyah
              </span>
            </div>
            <h1 className="text-xl sm:text-2xl font-black text-[#2D3436] tracking-tight">Data Kelas Madin (Diniyah)</h1>
            <p className="text-xs sm:text-sm font-medium text-[#636E72] mt-0.5">Kelola daftar rombel kelas Madrasah Diniyah santri Pondok Pesantren Qomaruddin.</p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            className="inline-flex min-h-11 items-center gap-2 rounded-2xl bg-[#138F81] hover:bg-[#0D7A6F] px-4 text-sm font-extrabold text-white shadow-lg shadow-[#138F81]/20 transition-all cursor-pointer"
            onClick={() =>
              setForm({
                name: '',
                code: '',
                category: 'Madin',
                gender_group: 'PA',
                is_active: true,
              })
            }
            type="button"
          >
            <Plus size={17} /> Tambah Kelas Madin
          </button>
          <button
            className={`q-refresh-button flex min-h-11 items-center gap-2 rounded-2xl bg-white border border-slate-200/80 px-4 text-sm font-bold text-[#138F81] hover:bg-slate-50 transition-all cursor-pointer shadow-xs ${isLoading ? 'is-loading' : ''}`}
            onClick={() => void load()}
            type="button"
            disabled={isLoading}
          >
            <RefreshCw className="q-refresh-icon" size={17} />
            {isLoading ? 'Refresh...' : 'Refresh'}
          </button>
        </div>
      </div>

      {/* SUMMARY STAT CARDS */}
      <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="rounded-3xl bg-white p-4.5 border border-slate-100 shadow-xs flex items-center gap-3.5">
          <div className="h-12 w-12 rounded-2xl bg-teal-50 border border-teal-100 flex items-center justify-center text-[#138F81] font-black">
            <BookOpen size={24} />
          </div>
          <div>
            <p className="text-xs font-bold text-slate-400">Total Rombel Madin</p>
            <p className="text-xl font-black text-slate-800">{classes.length} Kelas</p>
          </div>
        </div>

        <div className="rounded-3xl bg-white p-4.5 border border-slate-100 shadow-xs flex items-center gap-3.5">
          <div className="h-12 w-12 rounded-2xl bg-blue-50 border border-blue-100 flex items-center justify-center text-blue-700 font-black">
            <span className="text-xl">👦</span>
          </div>
          <div>
            <p className="text-xs font-bold text-slate-400">Kelas Putra (PA)</p>
            <p className="text-xl font-black text-blue-800">{totalPa} Rombel</p>
          </div>
        </div>

        <div className="rounded-3xl bg-white p-4.5 border border-slate-100 shadow-xs flex items-center gap-3.5">
          <div className="h-12 w-12 rounded-2xl bg-rose-50 border border-rose-100 flex items-center justify-center text-rose-700 font-black">
            <span className="text-xl">👧</span>
          </div>
          <div>
            <p className="text-xs font-bold text-slate-400">Kelas Putri (PI)</p>
            <p className="text-xl font-black text-rose-800">{totalPi} Rombel</p>
          </div>
        </div>

        <div className="rounded-3xl bg-white p-4.5 border border-slate-100 shadow-xs flex items-center gap-3.5">
          <div className="h-12 w-12 rounded-2xl bg-amber-50 border border-amber-100 flex items-center justify-center text-amber-700 font-black">
            <Users size={24} />
          </div>
          <div>
            <p className="text-xs font-bold text-slate-400">Total Santri Terhubung</p>
            <p className="text-xl font-black text-amber-800">{totalSiswa.toLocaleString('id-ID')} Santri</p>
          </div>
        </div>
      </section>

      {error ? (
        <div className="rounded-2xl bg-rose-50 p-4 text-sm font-bold text-rose-800 border border-rose-100 flex items-center gap-2">
          <span>⚠️</span> {error}
        </div>
      ) : null}

      {notice ? (
        <div className="rounded-2xl bg-emerald-50 p-4 text-sm font-bold text-emerald-800 border border-emerald-100 flex items-center gap-2">
          <span>✅</span> {notice}
        </div>
      ) : null}

      {/* FILTER & SEARCH CONTROLS */}
      <section className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 bg-white p-4 sm:p-5 rounded-3xl border border-slate-100 shadow-xs">
        <div className="flex flex-1 flex-wrap items-center gap-2.5">
          <div className="flex-1 min-w-[240px]">
            <SearchInput
              value={search}
              onChange={setSearch}
              placeholder="Cari kelas Madin (Sifir, Awal, PA/PI)..."
            />
          </div>

          {/* GENDER FILTER PILLS */}
          <div className="inline-flex items-center gap-1 p-1 bg-slate-100 rounded-2xl border border-slate-200 shrink-0">
            {[
              { id: 'all', label: `Semua (${classes.length})` },
              { id: 'PA', label: `👦 PA (${totalPa})` },
              { id: 'PI', label: `👧 PI (${totalPi})` },
              { id: 'Campur', label: `👥 Campur (${totalCampur})` },
            ].map((g) => (
              <button
                key={g.id}
                type="button"
                onClick={() => setGenderFilter(g.id as typeof genderFilter)}
                className={`px-3 py-1.5 text-xs font-extrabold rounded-xl transition-all ${
                  genderFilter === g.id
                    ? 'bg-white text-slate-900 shadow-xs ring-1 ring-black/5'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {g.label}
              </button>
            ))}
          </div>

          {/* QUICK FILTER STATUS SANTRI */}
          <div className="inline-flex items-center gap-1 p-1 bg-slate-100 rounded-2xl border border-slate-200 shrink-0 self-start sm:self-auto overflow-x-auto max-w-full">
            <button
              type="button"
              onClick={() => setSantriFilter('all')}
              className={`px-3 py-1.5 rounded-xl text-xs font-extrabold transition-all ${
                santriFilter === 'all'
                  ? 'bg-white text-slate-800 shadow-xs ring-1 ring-black/5'
                  : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              Semua
            </button>
            <button
              type="button"
              onClick={() => setSantriFilter('has_santri')}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-extrabold transition-all ${
                santriFilter === 'has_santri'
                  ? 'bg-[#138F81] text-white shadow-xs'
                  : 'text-slate-600 hover:text-[#138F81]'
              }`}
              title="Tampilkan hanya kelas yang sudah terisi santri"
            >
              <span className={`h-2 w-2 rounded-full ${santriFilter === 'has_santri' ? 'bg-white' : 'bg-emerald-500'}`} />
              Ada Santri ({hasSantriCount})
            </button>
            <button
              type="button"
              onClick={() => setSantriFilter('no_santri')}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-extrabold transition-all ${
                santriFilter === 'no_santri'
                  ? 'bg-slate-700 text-white shadow-xs'
                  : 'text-slate-500 hover:text-slate-700'
              }`}
              title="Tampilkan kelas yang belum ada santrinya"
            >
              <span className={`h-2 w-2 rounded-full ${santriFilter === 'no_santri' ? 'bg-white' : 'bg-slate-400'}`} />
              Belum Terisi ({noSantriCount})
            </button>
          </div>
        </div>
      </section>

      {/* DATA TABLE */}
      <section className="q-table-container rounded-3xl bg-white p-4 shadow-sm md:p-6 lg:p-8">
        {isLoading ? (
          <div className="rounded-2xl bg-white px-4 py-8 text-center text-sm font-bold text-[#636E72]">
            Memuat data rombel kelas Madin...
          </div>
        ) : (
          <DataTable
            columns={columns}
            rows={filtered}
            defaultSortKey="name"
            defaultSortDirection="asc"
            emptyText={
              santriFilter === 'has_santri'
                ? 'Tidak ada kelas Madin yang memiliki santri.'
                : santriFilter === 'no_santri'
                ? 'Seluruh kelas Madin sudah terisi santri.'
                : 'Tidak ada data kelas Madin yang sesuai filter.'
            }
            mobileRender={(row) => {
              const genderGroup = String(row.gender_group || 'PA').toUpperCase();
              const isPa = genderGroup === 'PA' || genderGroup === 'PUTRA' || genderGroup === 'L';
              const studentCount = Number(row.student_count ?? row.students_count ?? 0);
              return (
                <article className="rounded-2xl border border-slate-200 bg-white p-4 shadow-xs space-y-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-3">
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-teal-50 text-[#138F81] border border-teal-100">
                        <BookOpen size={18} />
                      </div>
                      <div>
                        <p className="text-base font-black text-slate-800 leading-snug">{String(row.name || '-')}</p>
                        <p className="text-xs font-mono font-bold text-slate-400 mt-0.5">Kode: {String(row.code || '-')}</p>
                      </div>
                    </div>
                    <span className={`rounded-xl px-2.5 py-1 text-xs font-black inline-flex items-center gap-1 border shrink-0 ${
                      isPa ? 'bg-blue-50 text-blue-700 border-blue-200' : 'bg-pink-50 text-pink-700 border-pink-200'
                    }`}>
                      {isPa ? '👦 Putra (PA)' : '👧 Putri (PI)'}
                    </span>
                  </div>

                  <div className="flex items-center justify-between pt-2 border-t border-slate-100 text-xs font-bold text-slate-600">
                    <div className="flex items-center gap-1.5 text-slate-500">
                      <Users size={14} />
                      <span>{studentCount} Santri Terdaftar</span>
                    </div>
                    <span
                      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[11px] font-extrabold ${
                        row.is_active !== false
                          ? 'bg-emerald-100 text-emerald-800'
                          : 'bg-slate-100 text-slate-500'
                      }`}
                    >
                      <span className={`h-1.5 w-1.5 rounded-full ${row.is_active !== false ? 'bg-emerald-500' : 'bg-slate-400'}`} />
                      {row.is_active !== false ? 'Aktif' : 'Nonaktif'}
                    </span>
                  </div>

                  <div className="flex items-center gap-2 pt-1 border-t border-slate-100">
                    <button
                      className="flex-1 rounded-xl bg-[#EAF4FF] py-2 text-xs font-extrabold text-[#2E86DE] hover:bg-blue-100 transition-colors inline-flex items-center justify-center gap-1.5"
                      onClick={() => setForm(row)}
                      type="button"
                    >
                      <Pencil size={13} /> Edit Kelas
                    </button>
                    <button
                      className="rounded-xl bg-[#FDECEC] p-2 text-xs font-extrabold text-[#D63031] hover:bg-rose-100 transition-colors inline-flex items-center justify-center"
                      onClick={() => setDeleteTarget(row)}
                      type="button"
                      title="Hapus Kelas"
                    >
                      <Trash2 size={15} />
                    </button>
                  </div>
                </article>
              );
            }}
          />
        )}
      </section>

      {/* CONFIRM DELETE DIALOG */}
      {deleteTarget ? (
        <ConfirmDialog
          title="Hapus Kelas Madin"
          message={`Apakah Anda yakin ingin menghapus kelas "${String(deleteTarget.name)}"? Data relasi presensi santri lama tetap dijaga.`}
          tone="danger"
          isBusy={isSaving}
          onCancel={() => setDeleteTarget(null)}
          onConfirm={() => void deleteRecord()}
        />
      ) : null}
    </div>
  );
}
