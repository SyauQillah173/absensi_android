import {
  BookMarked,
  BookOpen,
  Calendar,
  CalendarCheck,
  Clock3,
  GraduationCap,
  Pencil,
  Plus,
  RefreshCw,
  Search,
  Trash2,
} from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { ComplexMapelForm, getGenderOfClass, getGenderOfTeacher } from '../components/ComplexMapelForm';
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

function CompactMapelJadwalList({ jadwals }: { jadwals: ApiRecord[] }) {
  const [isExpanded, setIsExpanded] = useState(false);

  if (!jadwals.length) {
    return <span className="text-xs font-semibold text-slate-400 italic">Belum ada jadwal KBM</span>;
  }

  const renderBadge = (j: ApiRecord, idx: number) => {
    const hari = text(j.hari);
    const jamMulai = formatTime(j.jam_mulai);
    const jamSelesai = formatTime(j.jam_selesai);
    const sifir = text(j.sifir ?? (j.class as ApiRecord)?.name);
    const guru = text(j.guru ?? (j.teacher as ApiRecord)?.name);
    const classGen = getGenderOfClass(j.class as ApiRecord);
    const teacherGen = getGenderOfTeacher(j.teacher as ApiRecord);
    const isPI = classGen === 'PI' || teacherGen === 'P' || sifir.toUpperCase().includes('PI');
    const isPA = classGen === 'PA' || teacherGen === 'L' || sifir.toUpperCase().includes('PA');

    return (
      <div
        key={idx}
        className={`inline-flex items-center gap-1.5 rounded-xl border px-2.5 py-1 text-xs shadow-2xs ${
          isPI
            ? 'bg-pink-50/80 border-pink-200/90 text-pink-900'
            : isPA
            ? 'bg-blue-50/80 border-blue-200/90 text-blue-900'
            : 'bg-teal-50/80 border-teal-200/90 text-teal-900'
        }`}
      >
        <span className="font-extrabold">{hari}</span>
        <span className="font-mono text-[11px] text-slate-500">
          ({jamMulai}-{jamSelesai})
        </span>
        <span
          className={`font-black rounded px-1 text-[10px] ${
            isPI ? 'bg-pink-200/70 text-pink-800' : isPA ? 'bg-blue-200/70 text-blue-800' : 'bg-teal-200/70 text-teal-800'
          }`}
        >
          {isPI ? '👧 PI' : isPA ? '👦 PA' : '👥'}: {sifir}
        </span>
        {guru && guru !== '-' && (
          <span className="font-bold text-slate-700 truncate max-w-[140px]">
            • {guru}
          </span>
        )}
      </div>
    );
  };

  if (jadwals.length <= 2) {
    return <div className="flex flex-wrap gap-1.5 max-w-md">{jadwals.map(renderBadge)}</div>;
  }

  return (
    <div className="space-y-1.5 max-w-md">
      <div className="flex flex-wrap items-center gap-1.5">
        {isExpanded ? jadwals.map(renderBadge) : jadwals.slice(0, 2).map(renderBadge)}
        <button
          type="button"
          onClick={() => setIsExpanded((prev) => !prev)}
          className="inline-flex items-center gap-1 rounded-lg bg-teal-100/90 hover:bg-teal-200 text-teal-900 px-2 py-0.5 text-[10px] font-black transition-colors cursor-pointer"
        >
          {isExpanded ? '▲ Ringkas' : `+${jadwals.length - 2} Jadwal Lainnya...`}
        </button>
      </div>
    </div>
  );
}

export function JadwalPelajaranPage() {
  const [activeView, setActiveView] = useState<'mapel' | 'matriks'>('mapel');
  const [mapelRows, setMapelRows] = useState<ApiRecord[]>([]);
  const [jadwalRows, setJadwalRows] = useState<ApiRecord[]>([]);
  const [classes, setClasses] = useState<ApiRecord[]>([]);
  const [teachers, setTeachers] = useState<ApiRecord[]>([]);

  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('Semua');
  const [dayFilter, setDayFilter] = useState('Semua');
  const [genderFilter, setGenderFilter] = useState<'all' | 'PA' | 'PI' | 'Campur'>('all');

  const [activeMapelFormData, setActiveMapelFormData] = useState<ApiRecord | null | undefined>(undefined);
  const [deleteMapelTarget, setDeleteMapelTarget] = useState<ApiRecord | null>(null);

  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const load = useCallback(async (silent = false) => {
    if (!silent) setIsLoading(true);
    setError('');
    try {
      const [mapelRes, jadwalRes, classRes, teacherRes] = await Promise.all([
        api.mataPelajaran({ status: statusFilter === 'Semua' ? '' : statusFilter }),
        api.jadwal(),
        api.classes(),
        api.users({ role: 'guru', status: 'Aktif' }),
      ]);
      setMapelRows(Array.isArray(mapelRes.data) ? mapelRes.data : []);
      setJadwalRows(Array.isArray(jadwalRes.data) ? jadwalRes.data : []);
      setClasses(Array.isArray(classRes.data) ? classRes.data : []);
      setTeachers(Array.isArray(teacherRes.data) ? teacherRes.data : []);
    } catch (err) {
      if (!silent) setError(err instanceof Error ? err.message : 'Data jadwal dan mata pelajaran gagal dimuat.');
    } finally {
      if (!silent) setIsLoading(false);
    }
  }, [statusFilter]);

  useEffect(() => {
    void load();

    const handleDataUpdate = (e: Event) => {
      const customEvt = e as CustomEvent;
      if (!customEvt.detail || customEvt.detail.type === 'mapel' || customEvt.detail.type === 'jadwal' || customEvt.detail.type === 'all') {
        void load(true);
      }
    };
    window.addEventListener('app:data-updated', handleDataUpdate);

    const handleFocus = () => void load(true);
    window.addEventListener('focus', handleFocus);

    const interval = setInterval(() => {
      if (document.visibilityState === 'visible' && activeMapelFormData === undefined) {
        void load(true);
      }
    }, 60000);

    return () => {
      window.removeEventListener('app:data-updated', handleDataUpdate);
      window.removeEventListener('focus', handleFocus);
      clearInterval(interval);
    };
  }, [load, activeMapelFormData]);

  const totalMapel = mapelRows.length;
  const totalJadwal = mapelRows.reduce((sum, row) => sum + list(row.jadwal).length, 0);
  const totalGuruAktif = useMemo(() => {
    const teacherIdSet = new Set<number>();
    mapelRows.forEach((row) => {
      list(row.guru).forEach((g) => {
        if (g.id) teacherIdSet.add(num(g.id));
      });
    });
    return teacherIdSet.size;
  }, [mapelRows]);

  const filteredMapel = useMemo(() => {
    let result = mapelRows;

    if (genderFilter !== 'all') {
      result = result.filter((row) => {
        const jadwals = list(row.jadwal);
        if (genderFilter === 'PA') {
          return jadwals.some(
            (j) =>
              getGenderOfClass(j.class as ApiRecord) === 'PA' ||
              getGenderOfTeacher(j.teacher as ApiRecord) === 'L' ||
              String(j.sifir || '').toUpperCase().includes('PA')
          );
        }
        if (genderFilter === 'PI') {
          return jadwals.some(
            (j) =>
              getGenderOfClass(j.class as ApiRecord) === 'PI' ||
              getGenderOfTeacher(j.teacher as ApiRecord) === 'P' ||
              String(j.sifir || '').toUpperCase().includes('PI')
          );
        }
        return true;
      });
    }

    const keyword = search.trim().toLowerCase();
    if (!keyword) return result;

    return result.filter((row) => {
      const nama = String(row.nama ?? '').toLowerCase();
      const kode = String(row.kode ?? '').toLowerCase();
      const guruNames = list(row.guru).map((g) => String(g.name ?? '')).join(' ').toLowerCase();
      const jadwalText = list(row.jadwal).map((j) => `${j.hari ?? ''} ${j.sifir ?? ''} ${j.ruangan ?? ''}`).join(' ').toLowerCase();
      return nama.includes(keyword) || kode.includes(keyword) || guruNames.includes(keyword) || jadwalText.includes(keyword);
    });
  }, [mapelRows, search, genderFilter]);

  const filteredJadwal = useMemo(() => {
    let result = jadwalRows;
    if (dayFilter !== 'Semua') {
      result = result.filter((j) => String(j.hari ?? j.day) === dayFilter);
    }
    if (genderFilter !== 'all') {
      result = result.filter((j) => {
        const cGen = getGenderOfClass(j.class as ApiRecord);
        const tGen = getGenderOfTeacher(j.teacher as ApiRecord);
        if (genderFilter === 'PA') return cGen === 'PA' || tGen === 'L';
        if (genderFilter === 'PI') return cGen === 'PI' || tGen === 'P';
        return true;
      });
    }
    const kw = search.trim().toLowerCase();
    if (!kw) return result;
    return result.filter((j) => {
      const mName = String(j.mapel_nama ?? j.mata_pelajaran_nama ?? (j.mata_pelajaran as ApiRecord)?.nama ?? '').toLowerCase();
      const gName = String(j.guru_nama ?? j.teacher_name ?? (j.teacher as ApiRecord)?.name ?? '').toLowerCase();
      const cName = String(j.class_name ?? j.kelas ?? j.sifir ?? '').toLowerCase();
      return mName.includes(kw) || gName.includes(kw) || cName.includes(kw) || String(j.hari ?? '').toLowerCase().includes(kw);
    });
  }, [jadwalRows, dayFilter, genderFilter, search]);

  const mapelColumns = useMemo<DataColumn<ApiRecord>[]>(
    () => [
      {
        key: 'nama',
        header: 'Mata Pelajaran',
        sortable: true,
        sortValue: (row) => String(row.nama ?? ''),
        render: (row) => (
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-teal-50 text-[#138F81] font-black text-sm border border-teal-100 shadow-2xs">
              <BookMarked size={18} />
            </div>
            <div>
              <span className="font-extrabold text-slate-800 text-sm block">{text(row.nama)}</span>
              {row.kode ? (
                <span className="text-[11px] font-bold text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded mt-0.5 inline-block">
                  Kode: {text(row.kode)}
                </span>
              ) : null}
            </div>
          </div>
        ),
      },
      {
        key: 'guru',
        header: 'Guru Pengampu (PA & PI)',
        sortable: true,
        sortValue: (row) => list(row.guru).length,
        render: (row) => {
          const gurus = list(row.guru);
          if (!gurus.length) {
            return <span className="text-xs font-semibold text-slate-400 italic">Belum diatur</span>;
          }
          return (
            <div className="flex flex-wrap gap-1.5 max-w-xs">
              {gurus.map((g, idx) => {
                const tGen = getGenderOfTeacher(g);
                return (
                  <span
                    key={idx}
                    className={`inline-flex items-center gap-1 rounded-lg px-2 py-0.5 text-[11px] font-bold border ${
                      tGen === 'P'
                        ? 'bg-pink-50 text-pink-800 border-pink-200'
                        : tGen === 'L'
                        ? 'bg-blue-50 text-blue-800 border-blue-200'
                        : 'bg-slate-100 text-slate-700 border-slate-200'
                    }`}
                  >
                    <span>{tGen === 'P' ? '👧 Ustadzah' : tGen === 'L' ? '👦 Ustadz' : '👤'}</span>
                    <span className="font-extrabold">{text(g.name)}</span>
                  </span>
                );
              })}
            </div>
          );
        },
      },
      {
        key: 'jadwal',
        header: 'Susunan Jadwal KBM',
        sortable: true,
        sortValue: (row) => list(row.jadwal).length,
        render: (row) => <CompactMapelJadwalList jadwals={list(row.jadwal)} />,
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
              className="rounded-xl bg-[#EAF4FF] px-3.5 py-2 text-xs font-extrabold text-[#2E86DE] hover:bg-[#d8ecff] transition-colors inline-flex items-center gap-1.5 cursor-pointer shadow-2xs"
              onClick={() => setActiveMapelFormData(row)}
              type="button"
              title="Atur guru pengajar, jam hari KBM untuk Putra (PA) & Putri (PI)"
            >
              <Pencil size={13} /> Edit Mapel & Jadwal
            </button>
            <button
              className="rounded-xl bg-[#FDECEC] px-3 py-2 text-xs font-extrabold text-[#D63031] hover:bg-[#fad4d4] transition-colors inline-flex items-center gap-1.5 cursor-pointer shadow-2xs"
              onClick={() => setDeleteMapelTarget(row)}
              type="button"
              title="Hapus mata pelajaran ini"
            >
              <Trash2 size={13} /> Hapus
            </button>
          </div>
        ),
      },
    ],
    []
  );

  async function handleDeleteMapel() {
    if (!deleteMapelTarget?.id || isSaving) return;
    setIsSaving(true);
    setError('');
    try {
      await api.deleteMataPelajaran(num(deleteMapelTarget.id));
      setDeleteMapelTarget(null);
      setNotice('Mata pelajaran & jadwal terkait berhasil dihapus.');
      await load(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Gagal menghapus mata pelajaran.');
    } finally {
      setIsSaving(false);
    }
  }

  if (activeMapelFormData !== undefined) {
    return (
      <ComplexMapelForm
        initialData={activeMapelFormData}
        onClose={() => {
          setActiveMapelFormData(undefined);
          void load(true);
        }}
        onSave={() => {
          setActiveMapelFormData(undefined);
          void load(true);
        }}
      />
    );
  }

  return (
    <div className="space-y-6">
      {/* 🌟 HEADER CARD JADWAL PELAJARAN & GURU */}
      <div className="q-card flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-5 sm:p-6 rounded-3xl bg-white border border-slate-200/80 shadow-sm">
        <div className="flex items-center gap-4">
          <div className="h-12 w-12 sm:h-14 sm:w-14 rounded-2xl bg-[#E1EFF7] text-[#138F81] border border-teal-100 flex items-center justify-center shrink-0 shadow-xs">
            <CalendarCheck className="w-6 h-6 sm:w-7 sm:h-7" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-[11px] font-bold uppercase tracking-wider text-[#636E72]">
                Akademik & KBM
              </span>
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black bg-[#E8F7F3] text-[#138F81] border border-[#138F81]/20">
                Pusat Jadwal Terpadu
              </span>
            </div>
            <h1 className="text-xl sm:text-2xl font-black text-[#2D3436] tracking-tight">
              Jadwal Pelajaran & Guru
            </h1>
            <p className="text-xs sm:text-sm font-medium text-[#636E72] mt-0.5">
              Atur mata pelajaran Madin, penugasan Ustadz (PA) & Ustadzah (PI), dan jam KBM dalam satu tempat.
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            className="inline-flex min-h-11 items-center gap-2 rounded-2xl bg-[#138F81] hover:bg-[#0D7A6F] px-4 text-sm font-extrabold text-white shadow-lg shadow-[#138F81]/20 transition-all cursor-pointer"
            onClick={() => setActiveMapelFormData(null)}
            type="button"
          >
            <Plus size={17} /> + Tambah Mata Pelajaran & Jadwal
          </button>
          <button
            className={`q-refresh-button flex min-h-11 items-center gap-2 rounded-2xl bg-white border border-slate-200/80 px-4 text-sm font-bold text-[#138F81] hover:bg-slate-50 transition-all cursor-pointer shadow-xs ${
              isLoading ? 'is-loading' : ''
            }`}
            onClick={() => void load()}
            type="button"
            disabled={isLoading}
          >
            <RefreshCw className={`q-refresh-icon ${isLoading ? 'animate-spin' : ''}`} size={17} /> Refresh
          </button>
        </div>
      </div>

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

      {/* STAT CARDS */}
      <div className="grid gap-4 md:grid-cols-3">
        <StatCard
          title="Total Mata Pelajaran"
          value={totalMapel}
          subtitle="Mapel Madin aktif kurikulum"
          icon={BookOpen}
          tone="teal"
        />
        <StatCard
          title="Slot Jadwal Terjadwal"
          value={totalJadwal}
          subtitle="Jadwal aktif KBM"
          icon={CalendarCheck}
          tone="blue"
        />
        <StatCard
          title="Guru / Ustadz Pengajar"
          value={totalGuruAktif}
          subtitle="Tercatat dalam jadwal KBM"
          icon={GraduationCap}
          tone="orange"
        />
      </div>

      {/* VIEW SELECTOR TAB */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-white p-2 rounded-2xl border border-slate-200 shadow-2xs">
        <div className="inline-flex items-center gap-1.5 p-1 bg-slate-100 rounded-xl">
          <button
            type="button"
            onClick={() => setActiveView('mapel')}
            className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-black transition-all cursor-pointer ${
              activeView === 'mapel'
                ? 'bg-white text-slate-800 shadow-xs ring-1 ring-black/5'
                : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            <BookMarked size={15} className={activeView === 'mapel' ? 'text-[#138F81]' : ''} />
            <span>I. Daftar Mata Pelajaran & Jadwal ({filteredMapel.length})</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveView('matriks')}
            className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-black transition-all cursor-pointer ${
              activeView === 'matriks'
                ? 'bg-white text-slate-800 shadow-xs ring-1 ring-black/5'
                : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            <Calendar size={15} className={activeView === 'matriks' ? 'text-[#138F81]' : ''} />
            <span>II. Matriks Jadwal Mingguan ({filteredJadwal.length})</span>
          </button>
        </div>

        {/* Gender Filter Pills */}
        <div className="inline-flex items-center gap-1 p-1 bg-slate-100 rounded-xl border border-slate-200">
          <button
            type="button"
            onClick={() => setGenderFilter('all')}
            className={`px-3 py-1.5 rounded-lg text-xs font-extrabold transition-all cursor-pointer ${
              genderFilter === 'all'
                ? 'bg-white text-slate-800 shadow-xs ring-1 ring-black/5'
                : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            Semua Gender
          </button>
          <button
            type="button"
            onClick={() => setGenderFilter('PA')}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-extrabold transition-all cursor-pointer ${
              genderFilter === 'PA'
                ? 'bg-blue-600 text-white shadow-xs'
                : 'text-blue-700 hover:bg-blue-50'
            }`}
          >
            <span>👦 Khusus Putra (PA)</span>
          </button>
          <button
            type="button"
            onClick={() => setGenderFilter('PI')}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-extrabold transition-all cursor-pointer ${
              genderFilter === 'PI'
                ? 'bg-pink-600 text-white shadow-xs'
                : 'text-pink-700 hover:bg-pink-50'
            }`}
          >
            <span>👧 Khusus Putri (PI)</span>
          </button>
        </div>
      </div>

      {/* VIEW 1: BERDASARKAN MATA PELAJARAN (UTAMA) */}
      {activeView === 'mapel' && (
        <section className="space-y-4 rounded-3xl bg-white p-4 sm:p-6 shadow-sm ring-1 ring-black/5 animate-in fade-in duration-200">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex-1 max-w-md">
              <SearchInput
                value={search}
                onChange={setSearch}
                placeholder="Cari mata pelajaran (Fiqih, Nahwu...), guru, atau kelas..."
              />
            </div>
            <div className="text-xs font-bold text-slate-500">
              Menampilkan {filteredMapel.length} dari {totalMapel} mata pelajaran
            </div>
          </div>

          <DataTable
            rows={filteredMapel}
            columns={mapelColumns}
            emptyText={
              isLoading
                ? 'Memuat mata pelajaran & jadwal...'
                : 'Belum ada mata pelajaran. Klik tombol Tambah di atas untuk membuat mata pelajaran baru.'
            }
            minWidth="900px"
            mobileRender={(row) => (
              <article className="rounded-2xl border border-slate-200 bg-white p-4 shadow-xs space-y-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <p className="text-base font-black text-slate-800 leading-snug">{text(row.nama)}</p>
                    {row.kode ? (
                      <p className="text-xs font-mono font-bold text-slate-400 mt-0.5">Kode: {text(row.kode)}</p>
                    ) : null}
                  </div>
                  <StatusBadge
                    label={text(row.status, 'Aktif')}
                    tone={text(row.status) === 'Aktif' ? 'success' : 'danger'}
                  />
                </div>

                <div className="space-y-1.5 pt-2 border-t border-slate-100">
                  <p className="text-[11px] font-black text-slate-500 uppercase tracking-wider">Jadwal & Pengajar:</p>
                  <CompactMapelJadwalList jadwals={list(row.jadwal)} />
                </div>

                <div className="flex items-center gap-2 pt-2 border-t border-slate-100">
                  <button
                    className="flex-1 rounded-xl bg-[#EAF4FF] py-2.5 text-xs font-extrabold text-[#2E86DE] hover:bg-[#d8ecff] transition-colors inline-flex items-center justify-center gap-1.5"
                    onClick={() => setActiveMapelFormData(row)}
                    type="button"
                  >
                    <Pencil size={13} /> Edit Mapel & Jadwal
                  </button>
                  <button
                    className="rounded-xl bg-[#FDECEC] p-2.5 text-xs font-extrabold text-[#D63031] hover:bg-[#fad4d4] transition-colors inline-flex items-center justify-center min-h-[38px] min-w-[38px]"
                    onClick={() => setDeleteMapelTarget(row)}
                    type="button"
                    title="Hapus"
                  >
                    <Trash2 size={15} />
                  </button>
                </div>
              </article>
            )}
          />
        </section>
      )}

      {/* VIEW 2: MATRIKS JADWAL MINGGUAN */}
      {activeView === 'matriks' && (
        <section className="space-y-4 rounded-3xl bg-white p-4 sm:p-6 shadow-sm ring-1 ring-black/5 animate-in fade-in duration-200">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex-1 max-w-md">
              <SearchInput
                value={search}
                onChange={setSearch}
                placeholder="Cari jadwal per hari..."
              />
            </div>

            <div className="flex items-center gap-1 overflow-x-auto no-scrollbar pb-1">
              {['Semua', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu', 'Ahad'].map((d) => (
                <button
                  key={d}
                  type="button"
                  onClick={() => setDayFilter(d)}
                  className={`px-3 py-1.5 text-xs font-extrabold rounded-xl transition-all whitespace-nowrap cursor-pointer ${
                    dayFilter === d
                      ? 'bg-[#138F81] text-white shadow-xs'
                      : 'bg-slate-100 text-slate-600 hover:text-slate-900'
                  }`}
                >
                  {d}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 gap-2.5">
            {filteredJadwal.length === 0 ? (
              <div className="p-8 text-center text-slate-400">
                <Calendar className="mx-auto text-slate-300 mb-2" size={32} />
                <p className="text-sm font-bold text-slate-600">Tidak ada jadwal pada filter ini.</p>
              </div>
            ) : (
              filteredJadwal.map((j, idx) => {
                const cGen = getGenderOfClass(j.class as ApiRecord);
                const tGen = getGenderOfTeacher(j.teacher as ApiRecord);
                const isPI = cGen === 'PI' || tGen === 'P';
                const isPA = cGen === 'PA' || tGen === 'L';

                return (
                  <div
                    key={idx}
                    className="flex flex-wrap items-center justify-between gap-3 p-4 rounded-2xl border border-slate-200 bg-white hover:border-slate-300 transition-all shadow-2xs"
                  >
                    <div className="flex items-center gap-3.5">
                      <div
                        className={`grid h-10 w-10 shrink-0 place-items-center rounded-xl font-black text-xs ${
                          isPI
                            ? 'bg-pink-50 text-pink-700 border border-pink-200'
                            : isPA
                            ? 'bg-blue-50 text-blue-700 border border-blue-200'
                            : 'bg-teal-50 text-[#138F81]'
                        }`}
                      >
                        {String(j.hari ?? j.day ?? '').slice(0, 3)}
                      </div>
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-extrabold text-sm text-slate-800">
                            {text(j.hari ?? j.day)}, {formatTime(j.jam_mulai ?? j.start_time)} - {formatTime(j.jam_selesai ?? j.end_time)}
                          </span>
                          <span className="font-black text-sm text-[#138F81]">
                            📖 {text(j.mapel_nama ?? j.mata_pelajaran_nama ?? (j.mata_pelajaran as ApiRecord)?.nama ?? j.mapel)}
                          </span>
                          <span className="rounded-md bg-slate-100 px-2 py-0.5 text-[11px] font-black text-slate-700">
                            🏫 {text(j.class_name ?? j.kelas ?? j.sifir)}
                          </span>
                          {isPI ? (
                            <span className="inline-flex items-center gap-1 rounded-md bg-pink-50 px-2 py-0.5 text-[10px] font-black text-pink-700 border border-pink-200">
                              👧 Putri (PI)
                            </span>
                          ) : isPA ? (
                            <span className="inline-flex items-center gap-1 rounded-md bg-blue-50 px-2 py-0.5 text-[10px] font-black text-blue-700 border border-blue-200">
                              👦 Putra (PA)
                            </span>
                          ) : null}
                        </div>
                        <p className="text-xs font-semibold text-slate-500 mt-1 flex items-center gap-1.5">
                          <GraduationCap size={13} className="text-[#138F81]" />
                          <span>
                            Guru Pengajar:{' '}
                            <b className="text-slate-800">
                              {text(j.guru_nama ?? j.teacher_name ?? (j.teacher as ApiRecord)?.name ?? j.guru)}
                            </b>
                          </span>
                        </p>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </section>
      )}

      {/* CONFIRM DELETE DIALOG */}
      {deleteMapelTarget && (
        <ConfirmDialog
          title="Hapus Mata Pelajaran & Jadwal?"
          message={`Apakah Anda yakin ingin menghapus mata pelajaran "${text(deleteMapelTarget?.nama)}"? Seluruh slot jadwal KBM terhubung akan ikut dihapus.`}
          confirmLabel={isSaving ? 'Menghapus...' : 'Ya, Hapus'}
          tone="danger"
          isBusy={isSaving}
          onConfirm={() => void handleDeleteMapel()}
          onCancel={() => setDeleteMapelTarget(null)}
        />
      )}
    </div>
  );
}
