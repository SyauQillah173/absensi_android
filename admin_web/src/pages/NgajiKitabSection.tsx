import {
  BookOpen,
  BookOpenCheck,
  CalendarDays,
  CheckCircle2,
  Clock3,
  Download,
  Pencil,
  Plus,
  RefreshCw,
  Save,
  Trash2,
  UsersRound,
  X
} from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useAuth } from '../auth/AuthContext';
import { ComplexNgajiForm } from '../components/ComplexNgajiForm';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { DataTable, type DataColumn } from '../components/DataTable';
import { SearchInput } from '../components/SearchInput';
import { StatCard } from '../components/StatCard';
import { StatusBadge } from '../components/StatusBadge';
import { api, type ApiRecord } from '../services/api';
import { exportNgajiRekapExcel } from '../utils/excel';
import { getTodayDateString } from '../utils/formatters';

type NgajiTab = 'input' | 'rekap' | 'master';
type NgajiStatus = '' | 'H' | 'I' | 'S' | 'A';

const statusLabels: Record<NgajiStatus, string> = {
  '': 'Belum',
  H: 'Hadir',
  I: 'Izin',
  S: 'Sakit',
  A: 'Alfa'
};

function today(): string {
  return getTodayDateString();
}

function text(value: unknown, fallback = '-'): string {
  const clean = String(value ?? '').trim();
  return clean || fallback;
}

function num(value: unknown): number {
  const result = Number(value ?? 0);
  return Number.isFinite(result) ? result : 0;
}

function record(value: unknown): ApiRecord {
  return value && typeof value === 'object' && !Array.isArray(value) ? (value as ApiRecord) : {};
}

function rows(value: unknown): ApiRecord[] {
  return Array.isArray(value) ? (value as ApiRecord[]) : [];
}

function statusTone(status: string): 'success' | 'warning' | 'danger' | 'neutral' | 'info' {
  if (status === 'H' || status === 'Hadir' || status === 'Aktif') return 'success';
  if (status === 'I' || status === 'Izin') return 'warning';
  if (status === 'S' || status === 'Sakit' || status === 'Nonaktif') return 'danger';
  if (status === 'A' || status === 'Alfa') return 'info';
  return 'neutral';
}

function ngajiError(err: unknown, fallback: string): string {
  const message = err instanceof Error ? err.message : fallback;
  if (message.toLowerCase().includes('absensi-ngaji') && message.toLowerCase().includes('could not be found')) {
    return 'Fitur Absensi Ngaji menunggu backend terbaru. Silakan deploy backend dan jalankan migrasi.';
  }
  return message || fallback;
}

export function NgajiKitabSection({ initialSection = 'input' }: { initialSection?: NgajiTab }) {
  const [activeTab, setActiveTab] = useState<NgajiTab>(initialSection);

  useEffect(() => {
    setActiveTab(initialSection);
  }, [initialSection]);

  return (
    <div className="space-y-6">
      {activeTab === 'input' ? <NgajiInput /> : null}
      {activeTab === 'rekap' ? <NgajiRekap /> : null}
      {activeTab === 'master' ? <NgajiMaster /> : null}
    </div>
  );
}

// ==========================================
// 1. INPUT PRESENSI NGAJI (HARIAN)
// ==========================================
function NgajiInput() {
  const { session } = useAuth();
  const [date, setDate] = useState(today());
  const [schedules, setSchedules] = useState<ApiRecord[]>([]);
  const [scheduleId, setScheduleId] = useState(0);
  const [studentRows, setStudentRows] = useState<ApiRecord[]>([]);
  const [statuses, setStatuses] = useState<Record<number, NgajiStatus>>({});
  const [summary, setSummary] = useState<Record<string, number>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  async function loadSchedules() {
    setIsLoading(true);
    setError('');
    try {
      const result = await api.ngajiSchedules({ active_only: 1 });
      const list = rows(result.data);
      setSchedules(list);
      setScheduleId((current) => current || num(list[0]?.id));
    } catch (err) {
      setError(ngajiError(err, 'Jadwal ngaji gagal dimuat.'));
    } finally {
      setIsLoading(false);
    }
  }

  async function loadContext() {
    if (!scheduleId) {
      setStudentRows([]);
      setStatuses({});
      setSummary({});
      return;
    }
    setIsLoading(true);
    setError('');
    setNotice('');
    try {
      const result = await api.absensiNgajiContext({ tanggal: date, ngaji_schedule_id: scheduleId });
      const data = record(result.data);
      const contextRows = rows(data.rows);
      const nextStatuses: Record<number, NgajiStatus> = {};
      const nextStudents = contextRows.map((item) => {
        const siswa = record(item.siswa);
        const absensi = record(item.absensi);
        const id = num(siswa.id);
        nextStatuses[id] = text(absensi.status_code, '') as NgajiStatus;
        return siswa;
      });
      setStudentRows(nextStudents);
      setStatuses(nextStatuses);
      setSummary(record(data.summary) as Record<string, number>);
    } catch (err) {
      setError(ngajiError(err, 'Data absensi ngaji santri gagal dimuat.'));
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    void loadSchedules();
  }, []);

  useEffect(() => {
    void loadContext();
  }, [date, scheduleId]);

  // Tandai semua santri hadir
  const handleMarkAllHadir = () => {
    const next: Record<number, NgajiStatus> = {};
    studentRows.forEach((s) => {
      next[num(s.id)] = 'H';
    });
    setStatuses(next);
  };

  async function save() {
    if (!session || !scheduleId) return;
    const items = Object.entries(statuses)
      .filter(([, status]) => Boolean(status))
      .map(([siswaId, status]) => ({ siswa_id: Number(siswaId), status_code: status as 'H' | 'I' | 'S' | 'A' }));

    if (items.length === 0) {
      setError('Pilih minimal satu status santri terlebih dahulu.');
      return;
    }

    setIsSaving(true);
    setError('');
    setNotice('');
    try {
      const result = await api.createAbsensiNgajiBulk({
        tanggal: date,
        ngaji_schedule_id: scheduleId,
        actor_user_id: session.id,
        diinput_oleh: session.name,
        items
      });
      await loadContext();
      setNotice(text(result.message, 'Absensi ngaji santri berhasil disimpan.'));
    } catch (err) {
      setError(ngajiError(err, 'Absensi ngaji gagal disimpan.'));
    } finally {
      setIsSaving(false);
    }
  }

  const selectedSchedule = schedules.find((s) => num(s.id) === scheduleId);

  return (
    <div className="space-y-5">
      <Message error={error} notice={notice} />

      {/* FILTER PANEL */}
      <section className="q-panel grid gap-3 p-4 md:grid-cols-[200px_minmax(0,1fr)_auto]">
        <div>
          <label className="block text-[11px] font-black text-slate-500 uppercase tracking-wider mb-1">Tanggal</label>
          <input className="q-input font-bold w-full" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        </div>

        <div>
          <label className="block text-[11px] font-black text-slate-500 uppercase tracking-wider mb-1">Jadwal Pengajian (Subuh / Sore)</label>
          <select className="q-input font-bold w-full" value={scheduleId} onChange={(e) => setScheduleId(Number(e.target.value))}>
            <option value={0}>-- Pilih Jadwal Pengajian --</option>
            {schedules.map((schedule) => {
              const isSubuh = String(schedule.sesi || '').toLowerCase().includes('subuh');
              const icon = isSubuh ? '🌅' : '🌇';
              const isPI = String(schedule.gender || '').toUpperCase() === 'PI';
              const genLabel = isPI ? '👧 Putri (PI)' : '👦 Putra (PA)';
              const kitab = text(schedule.kitab_nama || (schedule.kitab !== '-' && schedule.kitab !== 'Kajian Pondok' ? schedule.kitab : ''));
              const guru = text(schedule.pengajar);
              const count = num(schedule.student_count);

              return (
                <option key={text(schedule.id)} value={text(schedule.id)}>
                  {icon} {text(schedule.sesi, 'Ngaji')} • {genLabel} {kitab ? `• Kitab: ${kitab}` : ''} {guru && guru !== '-' ? `• ${guru}` : ''} ({count} Santri)
                </option>
              );
            })}
          </select>
        </div>

        <div className="flex items-end">
          <RefreshButton isLoading={isLoading} onClick={() => void loadContext()} />
        </div>
      </section>

      {/* STAT CARDS */}
      <div className="grid gap-3 sm:grid-cols-4">
        <StatCard title="Hadir" value={num(summary.H)} subtitle="Santri Hadir" icon={BookOpenCheck} tone="teal" />
        <StatCard title="Izin" value={num(summary.I)} subtitle="Santri Izin" icon={CalendarDays} tone="orange" />
        <StatCard title="Sakit" value={num(summary.S)} subtitle="Santri Sakit" icon={CalendarDays} tone="red" />
        <StatCard title="Belum Dipilih" value={num(summary.kosong)} subtitle="Menunggu Input" icon={Clock3} tone="blue" />
      </div>

      {/* QUICK ACTIONS TOOLBAR */}
      {studentRows.length > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-3 bg-white p-3.5 rounded-2xl border border-slate-200/80 shadow-2xs">
          <div className="flex items-center gap-2">
            <span className="text-xs font-black text-slate-700">
              Total {studentRows.length} Santri Terdaftar
            </span>
            {selectedSchedule && (
              <span className={`px-2 py-0.5 rounded-md text-[11px] font-black ${
                String(selectedSchedule.gender || '').toUpperCase() === 'PI' ? 'bg-pink-100 text-pink-800' : 'bg-blue-100 text-blue-800'
              }`}>
                {String(selectedSchedule.gender || '').toUpperCase() === 'PI' ? '👧 Putri (PI)' : '👦 Putra (PA)'}
              </span>
            )}
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleMarkAllHadir}
              className="inline-flex items-center gap-1.5 rounded-xl bg-teal-50 border border-teal-200 px-3 py-1.5 text-xs font-black text-[#138F81] hover:bg-teal-100 transition-colors cursor-pointer"
            >
              ✓ Tandai Semua Hadir
            </button>
            <button
              type="button"
              onClick={() => setStatuses({})}
              className="inline-flex items-center gap-1.5 rounded-xl bg-slate-100 border border-slate-200 px-3 py-1.5 text-xs font-black text-slate-600 hover:bg-slate-200 transition-colors cursor-pointer"
            >
              Reset
            </button>
          </div>
        </div>
      )}

      {/* ATTENDANCE ROWS */}
      <AttendanceRows
        rows={studentRows}
        isLoading={isLoading}
        statuses={statuses}
        isPI={String(selectedSchedule?.gender || '').toUpperCase() === 'PI'}
        onChange={(id, status) => setStatuses((current) => ({ ...current, [id]: status }))}
      />

      {/* SAVE BAR */}
      {studentRows.length > 0 && (
        <div className="q-panel flex flex-wrap items-center justify-between gap-3 p-4 sticky bottom-4 shadow-xl border border-teal-200/70 bg-white/95 backdrop-blur-xs rounded-2xl">
          <div className="text-xs font-bold text-slate-600">
            {Object.keys(statuses).filter((k) => Boolean(statuses[Number(k)])).length} dari {studentRows.length} santri telah diabsen
          </div>
          <button
            className="flex min-h-11 items-center gap-2 rounded-2xl bg-[#138F81] hover:bg-[#0f766a] px-6 text-sm font-black text-white shadow-md shadow-[#138F81]/25 disabled:opacity-60 transition-all cursor-pointer"
            type="button"
            onClick={() => void save()}
            disabled={isSaving || studentRows.length === 0}
          >
            <Save size={18} /> {isSaving ? 'Menyimpan...' : 'Simpan Absensi Pengajian'}
          </button>
        </div>
      )}
    </div>
  );
}

// ==========================================
// 2. REKAP PRESENSI NGAJI
// ==========================================
function NgajiRekap() {
  const [month, setMonth] = useState(String(new Date().getMonth() + 1));
  const [year, setYear] = useState(String(new Date().getFullYear()));
  const [search, setSearch] = useState('');
  const [rowsData, setRowsData] = useState<ApiRecord[]>([]);
  const [records, setRecords] = useState<ApiRecord[]>([]);
  const [summary, setSummary] = useState<ApiRecord>({});
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  async function load() {
    setIsLoading(true);
    setError('');
    try {
      const result = await api.rekapAbsensiNgaji({ bulan: Number(month), tahun: Number(year) });
      const data = record(result.data);
      setRowsData(rows(data.data));
      setRecords(rows(data.records));
      setSummary(record(data.summary));
    } catch (err) {
      setError(ngajiError(err, 'Rekap ngaji gagal dimuat.'));
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  const filtered = useMemo(() => {
    const keyword = search.trim().toLowerCase();
    if (!keyword) return rowsData;
    return rowsData.filter((row) => {
      const nama = String(row.nama ?? '').toLowerCase();
      const kelas = String(row.kelas ?? '').toLowerCase();
      const sesi = String(row.sesi ?? '').toLowerCase();
      const kitab = String(row.kitab ?? '').toLowerCase();
      const pengajar = String(row.pengajar ?? '').toLowerCase();
      return nama.includes(keyword) || kelas.includes(keyword) || sesi.includes(keyword) || kitab.includes(keyword) || pengajar.includes(keyword);
    });
  }, [rowsData, search]);

  const columns: DataColumn<ApiRecord>[] = [
    { key: 'siswa', header: 'Santri', render: (row) => <span className="font-extrabold text-slate-800">{text(row.nama)}</span> },
    { key: 'sesi', header: 'Sesi Pengajian', render: (row) => <span className="font-bold">{text(row.sesi)}</span> },
    { key: 'kitab', header: 'Kitab', render: (row) => text(row.kitab, 'Rutin') },
    { key: 'pengajar', header: 'Pengajar', render: (row) => text(row.pengajar) },
    { key: 'H', header: 'Hadir', render: (row) => <span className="text-emerald-700 font-extrabold">{num(row.H)}</span> },
    { key: 'I', header: 'Izin', render: (row) => num(row.I) },
    { key: 'S', header: 'Sakit', render: (row) => num(row.S) },
    { key: 'A', header: 'Alfa', render: (row) => <span className="text-rose-600 font-extrabold">{num(row.A)}</span> },
    { key: 'kosong', header: 'Kosong', render: (row) => num(row.Kosong) }
  ];

  return (
    <div className="space-y-5">
      {error ? <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-bold text-amber-800">{error}</div> : null}
      <div className="grid gap-3 sm:grid-cols-5">
        <StatCard title="Hadir" value={num(summary.H)} icon={BookOpenCheck} tone="teal" />
        <StatCard title="Izin" value={num(summary.I)} icon={CalendarDays} tone="orange" />
        <StatCard title="Sakit" value={num(summary.S)} icon={CalendarDays} tone="red" />
        <StatCard title="Alfa" value={num(summary.A)} icon={CalendarDays} tone="purple" />
        <StatCard title="Kosong" value={num(summary.Kosong)} icon={CalendarDays} tone="blue" />
      </div>

      <section className="q-panel grid gap-3 p-4 md:grid-cols-[140px_140px_minmax(0,1fr)_130px_130px]">
        <input className="q-input font-bold" value={month} onChange={(e) => setMonth(e.target.value)} placeholder="Bulan" />
        <input className="q-input font-bold" value={year} onChange={(e) => setYear(e.target.value)} placeholder="Tahun" />
        <SearchInput value={search} onChange={setSearch} placeholder="Cari santri / sesi / kitab / ustadz..." />
        <button
          className="inline-flex min-h-11 items-center justify-center gap-2 rounded-2xl bg-white px-4 text-sm font-extrabold text-[#138F81] border border-slate-200 shadow-xs hover:bg-slate-50 transition-all cursor-pointer"
          type="button"
          onClick={() => exportNgajiRekapExcel(records, summary, 'rekap_ngaji_qomaruddin.xlsx')}
          disabled={records.length === 0}
        >
          <Download size={16} /> Excel
        </button>
        <RefreshButton isLoading={isLoading} onClick={() => void load()} />
      </section>

      <section className="q-panel p-4 sm:p-6">
        {isLoading ? <LoadingText text="Memuat rekap ngaji..." /> : <DataTable rows={filtered} columns={columns} emptyText="Rekap ngaji belum tersedia." minWidth="980px" />}
      </section>
    </div>
  );
}

// ==========================================
// 3. MASTER JADWAL NGAJI (SUBUH & SORE)
// ==========================================
function NgajiMaster() {
  const [schedules, setSchedules] = useState<ApiRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [activeFormData, setActiveFormData] = useState<ApiRecord | null | undefined>(undefined);
  const [deleteTarget, setDeleteTarget] = useState<ApiRecord | null>(null);

  const [searchSchedule, setSearchSchedule] = useState('');
  const [sessionFilter, setSessionFilter] = useState<'all' | 'subuh' | 'sore'>('all');
  const [genderFilter, setGenderFilter] = useState<'all' | 'PA' | 'PI'>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | 'Aktif' | 'Nonaktif'>('all');

  const load = useCallback(async (silent = false) => {
    if (!silent) setIsLoading(true);
    setError('');
    try {
      const scheduleResult = await api.ngajiSchedules();
      setSchedules(rows(scheduleResult.data));
    } catch (err) {
      if (!silent) setError(ngajiError(err, 'Master jadwal ngaji gagal dimuat.'));
    } finally {
      if (!silent) setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const subuhCount = useMemo(() => {
    return schedules.filter((s) => String(s.sesi || '').toLowerCase().includes('subuh')).length;
  }, [schedules]);

  const soreCount = useMemo(() => {
    return schedules.filter((s) => String(s.sesi || '').toLowerCase().includes('sore')).length;
  }, [schedules]);

  const filteredSchedules = useMemo(() => {
    let list = schedules;

    // Filter Sesi
    if (sessionFilter === 'subuh') {
      list = list.filter((s) => String(s.sesi || '').toLowerCase().includes('subuh'));
    } else if (sessionFilter === 'sore') {
      list = list.filter((s) => String(s.sesi || '').toLowerCase().includes('sore'));
    }

    // Filter Gender
    if (genderFilter !== 'all') {
      list = list.filter((s) => String(s.gender || '').toUpperCase() === genderFilter);
    }

    // Filter Status
    if (statusFilter !== 'all') {
      list = list.filter((s) => text(s.status, 'Aktif') === statusFilter);
    }

    // Filter Search
    const kw = searchSchedule.trim().toLowerCase();
    if (!kw) return list;

    return list.filter((s) => {
      const match = `${s.sesi ?? ''} ${s.kitab ?? ''} ${s.kitab_nama ?? ''} ${s.pengajar ?? ''} ${s.hari ?? ''} ${s.gender ?? ''}`.toLowerCase();
      return match.includes(kw);
    });
  }, [schedules, sessionFilter, genderFilter, statusFilter, searchSchedule]);

  async function handleDelete() {
    if (!deleteTarget) return;
    setIsSaving(true);
    setError('');
    setNotice('');
    try {
      const id = num(deleteTarget.id);
      await api.deleteNgajiSchedule(id);
      setDeleteTarget(null);
      await load();
      setNotice('Jadwal pengajian berhasil dinonaktifkan.');
    } catch (err) {
      setError(ngajiError(err, 'Gagal menghapus jadwal ngaji.'));
    } finally {
      setIsSaving(false);
    }
  }

  // Buka form tambah / edit
  if (activeFormData !== undefined) {
    return (
      <ComplexNgajiForm
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

  const scheduleColumns: DataColumn<ApiRecord>[] = [
    {
      key: 'sesi',
      header: 'Sesi Pengajian',
      sortable: true,
      sortValue: (row) => String(row.sesi ?? ''),
      render: (row) => {
        const isSubuh = String(row.sesi || '').toLowerCase().includes('subuh');
        return (
          <div className="flex items-center gap-3">
            <div
              className={`flex h-10 w-10 items-center justify-center rounded-2xl text-xl font-bold shrink-0 shadow-2xs ${
                isSubuh ? 'bg-amber-100 text-amber-700' : 'bg-indigo-100 text-indigo-700'
              }`}
            >
              {isSubuh ? '🌅' : '🌇'}
            </div>
            <div>
              <p className="font-extrabold text-slate-800 text-sm">{text(row.sesi, 'Ngaji')}</p>
              <p className="text-[11px] font-mono text-slate-500">
                {text(row.start_time, '--:--')} - {text(row.end_time, '--:--')} WIB
              </p>
            </div>
          </div>
        );
      }
    },
    {
      key: 'gender',
      header: 'Kelompok Santri',
      sortable: true,
      sortValue: (row) => String(row.gender ?? ''),
      render: (row) => {
        const isPI = String(row.gender || '').toUpperCase() === 'PI';
        return (
          <span
            className={`inline-flex items-center gap-1.5 rounded-xl border px-3 py-1 text-xs font-black shadow-2xs ${
              isPI ? 'bg-pink-50 text-pink-800 border-pink-200' : 'bg-blue-50 text-blue-800 border-blue-200'
            }`}
          >
            <span>{isPI ? '👧' : '👦'}</span>
            <span>{isPI ? 'Putri (PI)' : 'Putra (PA)'}</span>
          </span>
        );
      }
    },
    {
      key: 'pengajar',
      header: 'Ustadz / Pengajar',
      sortable: true,
      sortValue: (row) => String(row.pengajar ?? ''),
      render: (row) => {
        const isPI = String(row.gender || '').toUpperCase() === 'PI';
        return (
          <div className="flex items-center gap-2">
            <span>{isPI ? '🧕' : '👳‍♂️'}</span>
            <span className="font-extrabold text-slate-800 text-xs sm:text-sm">
              {text(row.pengajar, 'Belum Ditentukan')}
            </span>
          </div>
        );
      }
    },
    {
      key: 'kitab',
      header: 'Kitab Kajian (Opsional)',
      sortable: true,
      sortValue: (row) => String(row.kitab_nama || row.kitab || ''),
      render: (row) => {
        const kitabName = text(row.kitab_nama || (row.kitab !== '-' && row.kitab !== 'Kajian Pondok' ? row.kitab : ''));
        if (kitabName) {
          return (
            <span className="font-extrabold text-slate-800 text-xs sm:text-sm bg-teal-50 border border-teal-100 px-2.5 py-1 rounded-xl">
              📖 {kitabName}
            </span>
          );
        }
        return <span className="text-xs font-semibold text-slate-400 italic">Pengajian Rutin</span>;
      }
    },
    {
      key: 'santri',
      header: 'Santri Terdaftar',
      sortable: true,
      sortValue: (row) => num(row.student_count),
      render: (row) => (
        <span className="inline-flex items-center gap-1.5 rounded-xl bg-slate-100 border border-slate-200/80 px-2.5 py-1 text-xs font-black text-slate-700">
          <UsersRound size={13} className="text-[#138F81]" />
          <span>{num(row.student_count)} Santri</span>
        </span>
      )
    },
    {
      key: 'hari',
      header: 'Hari',
      sortable: true,
      sortValue: (row) => String(row.hari ?? ''),
      render: (row) => <span className="text-xs font-bold text-slate-600">{text(row.hari, 'Setiap Hari')}</span>
    },
    {
      key: 'status',
      header: 'Status',
      sortable: true,
      sortValue: (row) => String(row.status ?? ''),
      render: (row) => <StatusBadge label={text(row.status)} tone={statusTone(text(row.status))} />
    },
    {
      key: 'aksi',
      header: 'Aksi',
      render: (row) => (
        <div className="flex gap-2 justify-end">
          <button
            className="rounded-xl bg-[#EAF4FF] px-3.5 py-2 text-xs font-extrabold text-[#2E86DE] hover:bg-[#d8ecff] transition-colors inline-flex items-center gap-1.5 cursor-pointer"
            type="button"
            onClick={() => setActiveFormData(row)}
          >
            <Pencil size={13} /> Edit Jadwal & Santri
          </button>
          <button
            className="rounded-xl bg-[#FDECEC] px-3.5 py-2 text-xs font-extrabold text-[#D63031] hover:bg-[#fad4d4] transition-colors inline-flex items-center gap-1.5 cursor-pointer"
            type="button"
            onClick={() => setDeleteTarget(row)}
          >
            <Trash2 size={13} /> Hapus
          </button>
        </div>
      )
    }
  ];

  return (
    <div className="space-y-6">
      <Message error={error} notice={notice} />

      {/* STAT CARDS */}
      <div className="grid gap-4 sm:grid-cols-3">
        <div className="rounded-3xl bg-white p-5 border border-slate-100 shadow-xs flex items-center gap-4">
          <div className="h-12 w-12 rounded-2xl bg-teal-50 border border-teal-100 flex items-center justify-center text-[#138F81] font-black">
            <BookOpen size={24} />
          </div>
          <div>
            <p className="text-xs font-bold text-slate-400">Total Jadwal Pengajian</p>
            <p className="text-xl font-black text-slate-800">{schedules.length} Jadwal</p>
          </div>
        </div>

        <div className="rounded-3xl bg-white p-5 border border-slate-100 shadow-xs flex items-center gap-4">
          <div className="h-12 w-12 rounded-2xl bg-amber-50 border border-amber-100 flex items-center justify-center text-amber-700 text-2xl font-black">
            🌅
          </div>
          <div>
            <p className="text-xs font-bold text-slate-400">Jadwal Ngaji Subuh</p>
            <p className="text-xl font-black text-amber-800">{subuhCount} Jadwal</p>
          </div>
        </div>

        <div className="rounded-3xl bg-white p-5 border border-slate-100 shadow-xs flex items-center gap-4">
          <div className="h-12 w-12 rounded-2xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-700 text-2xl font-black">
            🌇
          </div>
          <div>
            <p className="text-xs font-bold text-slate-400">Jadwal Ngaji Sore</p>
            <p className="text-xl font-black text-indigo-800">{soreCount} Jadwal</p>
          </div>
        </div>
      </div>

      {/* ACTION BAR */}
      <section className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 bg-white p-4 sm:p-5 rounded-3xl border border-slate-100 shadow-xs">
        <div className="flex flex-1 flex-wrap items-center gap-2.5">
          <div className="flex-1 min-w-[220px]">
            <SearchInput
              value={searchSchedule}
              onChange={setSearchSchedule}
              placeholder="Cari sesi / ustadz / kitab / hari..."
            />
          </div>

          {/* Sesi Filter */}
          <div className="inline-flex items-center gap-1 p-1 bg-slate-100 rounded-2xl border border-slate-200 shrink-0">
            {(['all', 'subuh', 'sore'] as const).map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => setSessionFilter(s)}
                className={`px-3 py-1.5 rounded-xl text-xs font-extrabold transition-all cursor-pointer ${
                  sessionFilter === s ? 'bg-white text-slate-800 shadow-xs' : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                {s === 'all' ? 'Semua Sesi' : s === 'subuh' ? '🌅 Subuh' : '🌇 Sore'}
              </button>
            ))}
          </div>

          {/* Gender Filter */}
          <div className="inline-flex items-center gap-1 p-1 bg-slate-100 rounded-2xl border border-slate-200 shrink-0">
            {(['all', 'PA', 'PI'] as const).map((g) => (
              <button
                key={g}
                type="button"
                onClick={() => setGenderFilter(g)}
                className={`px-3 py-1.5 rounded-xl text-xs font-extrabold transition-all cursor-pointer ${
                  genderFilter === g ? 'bg-white text-slate-800 shadow-xs' : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                {g === 'all' ? 'Semua Gender' : g === 'PA' ? '👦 Putra' : '👧 Putri'}
              </button>
            ))}
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            className="inline-flex min-h-11 items-center justify-center gap-2 rounded-2xl bg-[#138F81] hover:bg-[#0f766a] px-5 text-sm font-extrabold text-white shadow-md shadow-[#138F81]/20 transition-all cursor-pointer"
            type="button"
            onClick={() => setActiveFormData(null)}
          >
            <Plus size={17} /> Tambah Jadwal Ngaji Baru
          </button>
          <RefreshButton isLoading={isLoading} onClick={() => void load(true)} />
        </div>
      </section>

      {/* SCHEDULE DATA TABLE */}
      <section className="q-table-container rounded-3xl bg-white p-4 shadow-sm md:p-6 lg:p-8">
        <div className="mb-4">
          <h2 className="text-lg font-black text-slate-800">Daftar Jadwal Pengajian Santri (Ngaji Subuh & Sore)</h2>
          <p className="text-xs font-semibold text-slate-500">
            Penjadwalan KBM pesantren berdasarkan gender santri (Putra / Putri) dan penugasan pengajar.
          </p>
        </div>

        {isLoading ? (
          <LoadingText text="Memuat jadwal pengajian santri..." />
        ) : (
          <DataTable
            rows={filteredSchedules}
            columns={scheduleColumns}
            defaultSortKey="sesi"
            defaultSortDirection="asc"
            emptyText="Belum ada jadwal pengajian santri yang dibuat."
            minWidth="980px"
          />
        )}
      </section>

      {/* CONFIRM DELETE DIALOG */}
      {deleteTarget ? (
        <ConfirmDialog
          title="Nonaktifkan Jadwal Pengajian"
          message="Riwayat absensi santri yang sudah tersimpan sebelumnya tetap aman dan tidak akan terhapus."
          tone="danger"
          isBusy={isSaving}
          onCancel={() => setDeleteTarget(null)}
          onConfirm={() => void handleDelete()}
        />
      ) : null}
    </div>
  );
}

// ==========================================
// 4. ATTENDANCE ROWS COMPONENT
// ==========================================
function AttendanceRows({
  rows: studentRows,
  isLoading,
  statuses,
  isPI,
  onChange
}: {
  rows: ApiRecord[];
  isLoading: boolean;
  statuses: Record<number, NgajiStatus>;
  isPI?: boolean;
  onChange: (id: number, status: NgajiStatus) => void;
}) {
  if (isLoading) return <LoadingText text="Memuat daftar santri ngaji..." />;
  if (studentRows.length === 0) {
    return (
      <div className="q-card p-8 text-center text-sm font-bold text-[#636E72] bg-white rounded-3xl border border-slate-200">
        Belum ada santri yang terdaftar pada jadwal pengajian ini. Silakan atur anggota santri di tab Jadwal.
      </div>
    );
  }

  return (
    <section className="space-y-3">
      {studentRows.map((student, index) => {
        const id = num(student.id);
        const status = statuses[id] ?? '';

        return (
          <div
            key={id}
            className={`flex flex-wrap items-center justify-between gap-4 p-4 rounded-2xl border transition-all ${
              status === 'H'
                ? 'bg-teal-50/50 border-teal-200/80 shadow-2xs'
                : status === 'I'
                ? 'bg-amber-50/50 border-amber-200/80'
                : status === 'S'
                ? 'bg-rose-50/50 border-rose-200/80'
                : status === 'A'
                ? 'bg-purple-50/50 border-purple-200/80'
                : 'bg-white border-slate-200/90 shadow-2xs'
            }`}
          >
            <div className="flex items-center gap-3.5 min-w-[240px] flex-1">
              <span className="grid h-10 w-10 place-items-center rounded-xl bg-slate-100 text-xs font-black text-slate-600 shrink-0">
                {index + 1}
              </span>

              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-teal-100/70 text-base shadow-2xs">
                {isPI ? '👧' : '👦'}
              </div>

              <div className="min-w-0">
                <p className="text-sm font-black text-slate-800 truncate">{text(student.nama)}</p>
                <div className="flex items-center gap-2 mt-0.5">
                  <span className="text-[11px] font-semibold text-slate-500">
                    {student.kamar ? `Kamar: ${student.kamar}` : (student.kelas ? `Kelas: ${student.kelas}` : `NIS: ${text(student.nis, '-')}`)}
                  </span>
                  {status ? <StatusBadge label={statusLabels[status]} tone={statusTone(status)} /> : null}
                </div>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-1.5 shrink-0">
              {(['H', 'I', 'S', 'A'] as const).map((option) => {
                const isActive = status === option;
                return (
                  <button
                    key={option}
                    type="button"
                    onClick={() => onChange(id, option)}
                    className={`h-10 min-w-10 px-3.5 rounded-xl text-xs font-black transition-all cursor-pointer ${
                      isActive
                        ? option === 'H'
                          ? 'bg-[#138F81] text-white shadow-xs'
                          : option === 'I'
                          ? 'bg-amber-500 text-white shadow-xs'
                          : option === 'S'
                          ? 'bg-rose-500 text-white shadow-xs'
                          : 'bg-purple-600 text-white shadow-xs'
                        : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                    }`}
                  >
                    {option === 'H' ? 'Hadir' : option === 'I' ? 'Izin' : option === 'S' ? 'Sakit' : 'Alfa'}
                  </button>
                );
              })}
            </div>
          </div>
        );
      })}
    </section>
  );
}

function RefreshButton({ isLoading, onClick }: { isLoading: boolean; onClick: () => void }) {
  return (
    <button
      className={`flex min-h-11 items-center justify-center gap-2 rounded-2xl bg-white px-4 text-sm font-bold text-[#138F81] border border-slate-200/70 shadow-2xs hover:bg-slate-50 transition-colors cursor-pointer ${
        isLoading ? 'is-loading' : ''
      }`}
      onClick={onClick}
      type="button"
      disabled={isLoading}
    >
      <RefreshCw className={`q-refresh-icon ${isLoading ? 'animate-spin' : ''}`} size={16} />
      {isLoading ? 'Menyegarkan...' : 'Refresh'}
    </button>
  );
}

function Message({ error, notice }: { error?: string; notice?: string }) {
  return (
    <>
      {error ? (
        <div className="rounded-2xl bg-[#FDECEC] px-4 py-3 text-sm font-bold text-[#D63031] border border-rose-100 flex items-center gap-2 animate-in fade-in duration-200">
          <span>⚠️</span> {error}
        </div>
      ) : null}
      {notice ? (
        <div className="rounded-2xl bg-[#E8F7F3] px-4 py-3 text-sm font-bold text-[#138F81] border border-teal-100 flex items-center gap-2 animate-in fade-in duration-200">
          <span>✅</span> {notice}
        </div>
      ) : null}
    </>
  );
}

function LoadingText({ text: label }: { text: string }) {
  return (
    <div className="p-8 text-center text-sm font-bold text-slate-400 flex items-center justify-center gap-2">
      <RefreshCw size={16} className="animate-spin text-[#138F81]" />
      <span>{label}</span>
    </div>
  );
}
