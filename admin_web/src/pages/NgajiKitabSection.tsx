import {
  BookOpen,
  BookOpenCheck,
  CalendarDays,
  Camera,
  CheckCircle2,
  Clock3,
  Download,
  Edit3,
  GraduationCap,
  Image as ImageIcon,
  Landmark,
  Pencil,
  Plus,
  RefreshCw,
  Save,
  Trash2,
  UsersRound,
  X
} from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useAuth } from '../auth/AuthContext';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { DataTable, type DataColumn } from '../components/DataTable';
import { SearchInput } from '../components/SearchInput';
import { StatCard } from '../components/StatCard';
import { StatusBadge } from '../components/StatusBadge';
import { api, type ApiRecord } from '../services/api';
import { exportNgajiRekapExcel } from '../utils/excel';
import { getTodayDateString } from '../utils/formatters';
import { ComplexNgajiForm } from '../components/ComplexNgajiForm';

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
    return 'Fitur Absensi Ngaji menunggu backend terbaru. Deploy backend terbaru lalu jalankan migrasi database agar master ngaji aktif.';
  }
  return message || fallback;
}

// Local storage helper for book covers (stored locally on device without burdening server)
function getBookCover(key: string): string | null {
  try {
    return localStorage.getItem(`kitab_img_${key}`);
  } catch {
    return null;
  }
}

function saveBookCover(key: string, base64: string): void {
  try {
    localStorage.setItem(`kitab_img_${key}`, base64);
  } catch {
    // ignore quota errors
  }
}

function removeBookCover(key: string): void {
  try {
    localStorage.removeItem(`kitab_img_${key}`);
  } catch {}
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
      setError(ngajiError(err, 'Data absensi ngaji gagal dimuat.'));
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

  async function save() {
    if (!session || !scheduleId) return;
    const items = Object.entries(statuses)
      .filter(([, status]) => Boolean(status))
      .map(([siswaId, status]) => ({ siswa_id: Number(siswaId), status_code: status as 'H' | 'I' | 'S' | 'A' }));
    if (items.length === 0) {
      setError('Pilih minimal satu status santri dulu.');
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
      setNotice(text(result.message, 'Absensi ngaji berhasil disimpan.'));
    } catch (err) {
      setError(ngajiError(err, 'Absensi ngaji gagal disimpan.'));
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <div className="space-y-5">
      <Message error={error} notice={notice} />
      <section className="q-panel grid gap-3 p-4 md:grid-cols-[220px_minmax(0,1fr)_150px]">
        <input className="q-input font-bold" type="date" value={date} onChange={(event) => setDate(event.target.value)} />
        <select className="q-input font-bold" value={scheduleId} onChange={(event) => setScheduleId(Number(event.target.value))}>
          <option value={0}>Pilih jadwal ngaji kitab</option>
          {schedules.map((schedule) => (
            <option key={text(schedule.id)} value={text(schedule.id)}>
              {text(schedule.sesi)} - {text(schedule.kitab)} - {text(schedule.kamar ?? schedule.kelas ?? schedule.komplek, 'Semua santri')}
            </option>
          ))}
        </select>
        <RefreshButton isLoading={isLoading} onClick={() => void loadContext()} />
      </section>

      <div className="grid gap-4 md:grid-cols-4">
        <StatCard title="Hadir" value={num(summary.H)} subtitle="Status Hadir" icon={BookOpenCheck} tone="teal" />
        <StatCard title="Izin" value={num(summary.I)} subtitle="Status Izin" icon={CalendarDays} tone="orange" />
        <StatCard title="Sakit" value={num(summary.S)} subtitle="Status Sakit" icon={CalendarDays} tone="red" />
        <StatCard title="Belum" value={num(summary.kosong)} subtitle="Belum dipilih" icon={CalendarDays} tone="blue" />
      </div>

      <AttendanceRows rows={studentRows} isLoading={isLoading} statuses={statuses} onChange={(id, status) => setStatuses((current) => ({ ...current, [id]: status }))} />

      <div className="q-panel q-save-bar flex flex-wrap items-center justify-end gap-3 p-4">
        <button className="q-soft-action q-save-secondary min-h-12 rounded-2xl bg-white px-5 text-sm font-extrabold text-[#636E72] border border-slate-200" type="button" onClick={() => setStatuses({})} disabled={isSaving}>
          Reset Pilihan
        </button>
        <button className="q-soft-action q-save-primary flex min-h-12 items-center gap-2 rounded-2xl bg-[#138F81] px-6 text-sm font-extrabold text-white shadow-lg shadow-[#138F81]/25 disabled:opacity-60" type="button" onClick={() => void save()} disabled={isSaving || studentRows.length === 0}>
          <Save size={18} /> {isSaving ? 'Menyimpan...' : 'Simpan Absensi Ngaji'}
        </button>
      </div>
    </div>
  );
}

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
    { key: 'kelas', header: 'Kelas', render: (row) => text(row.kelas) },
    { key: 'sesi', header: 'Sesi', render: (row) => text(row.sesi) },
    { key: 'kitab', header: 'Kitab', render: (row) => text(row.kitab) },
    { key: 'pengajar', header: 'Pengajar', render: (row) => text(row.pengajar) },
    { key: 'H', header: 'Hadir', render: (row) => num(row.H) },
    { key: 'I', header: 'Izin', render: (row) => num(row.I) },
    { key: 'S', header: 'Sakit', render: (row) => num(row.S) },
    { key: 'A', header: 'Alfa', render: (row) => num(row.A) },
    { key: 'kosong', header: 'Kosong', render: (row) => num(row.Kosong) }
  ];

  return (
    <div className="space-y-5">
      {error ? <div className="rounded-2xl border border-[#FFE6A6] bg-[#FFF7D6] px-4 py-3 text-sm font-bold text-[#8A5A00]">{error}</div> : null}
      <div className="grid gap-4 md:grid-cols-5">
        <StatCard title="Hadir" value={num(summary.H)} icon={BookOpenCheck} tone="teal" />
        <StatCard title="Izin" value={num(summary.I)} icon={CalendarDays} tone="orange" />
        <StatCard title="Sakit" value={num(summary.S)} icon={CalendarDays} tone="red" />
        <StatCard title="Alfa" value={num(summary.A)} icon={CalendarDays} tone="purple" />
        <StatCard title="Kosong" value={num(summary.Kosong)} icon={CalendarDays} tone="blue" />
      </div>

      <section className="q-panel q-rekap-action-panel grid gap-3 p-4 md:grid-cols-[140px_140px_minmax(0,1fr)_130px_130px]">
        <input className="q-input font-bold" value={month} onChange={(event) => setMonth(event.target.value)} placeholder="Bulan" />
        <input className="q-input font-bold" value={year} onChange={(event) => setYear(event.target.value)} placeholder="Tahun" />
        <SearchInput value={search} onChange={setSearch} placeholder="Cari santri / kelas / kitab / pengajar" />
        <button className="q-soft-action q-rekap-button inline-flex min-h-12 items-center justify-center gap-2 rounded-2xl bg-white px-4 text-sm font-extrabold text-[#138F81] border border-slate-200 shadow-xs" type="button" onClick={() => exportNgajiRekapExcel(records, summary, 'rekap_ngaji_qomaruddin.xlsx')} disabled={records.length === 0}>
          <Download size={17} /> Excel
        </button>
        <RefreshButton isLoading={isLoading} onClick={() => void load()} />
      </section>

      <section className="q-panel p-4 sm:p-6">
        {isLoading ? <LoadingText text="Memuat rekap ngaji..." /> : <DataTable rows={filtered} columns={columns} emptyText="Rekap ngaji belum tersedia." minWidth="980px" />}
      </section>
    </div>
  );
}

function NgajiMaster() {
  const [sessions, setSessions] = useState<ApiRecord[]>([]);
  const [books, setBooks] = useState<ApiRecord[]>([]);
  const [schedules, setSchedules] = useState<ApiRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [activeFormData, setActiveFormData] = useState<ApiRecord | null | undefined>(undefined);
  const [deleteTarget, setDeleteTarget] = useState<{ type: 'book' | 'schedule'; row: ApiRecord } | null>(null);

  const [searchSchedule, setSearchSchedule] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'Aktif' | 'Nonaktif'>('all');

  const load = useCallback(async (silent = false) => {
    if (!silent) setIsLoading(true);
    setError('');
    try {
      const [sessionResult, bookResult, scheduleResult] = await Promise.all([
        api.ngajiSessions(),
        api.ngajiBooks(),
        api.ngajiSchedules()
      ]);
      setSessions(rows(sessionResult.data));
      setBooks(rows(bookResult.data));
      setSchedules(rows(scheduleResult.data));
    } catch (err) {
      if (!silent) setError(ngajiError(err, 'Master ngaji gagal dimuat.'));
    } finally {
      if (!silent) setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();

    // 1. Auto-refresh saat event app:data-updated dipicu
    const handleDataUpdate = (e: Event) => {
      const customEvt = e as CustomEvent;
      if (!customEvt.detail || customEvt.detail.type === 'ngaji' || customEvt.detail.type === 'all') {
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

  const activeCount = useMemo(() => schedules.filter((s) => text(s.status, 'Aktif') === 'Aktif').length, [schedules]);
  const inactiveCount = useMemo(() => schedules.filter((s) => text(s.status) === 'Nonaktif').length, [schedules]);

  const filteredSchedules = useMemo(() => {
    let list = schedules;
    if (statusFilter !== 'all') {
      list = list.filter((s) => text(s.status, 'Aktif') === statusFilter);
    }
    const kw = searchSchedule.trim().toLowerCase();
    if (!kw) return list;
    return list.filter((s) => {
      const match = `${s.kitab ?? ''} ${s.pengajar ?? ''} ${s.sesi ?? ''} ${s.kamar ?? ''} ${s.komplek ?? ''} ${s.hari ?? ''}`.toLowerCase();
      return match.includes(kw);
    });
  }, [schedules, searchSchedule, statusFilter]);


  async function deactivate() {
    if (!deleteTarget) return;
    setIsSaving(true);
    setError('');
    setNotice('');
    try {
      const id = num(deleteTarget.row.id);
      if (deleteTarget.type === 'book') {
        await api.deleteNgajiBook(id);
        removeBookCover(String(deleteTarget.row.code || id));
      }
      if (deleteTarget.type === 'schedule') await api.deleteNgajiSchedule(id);
      setDeleteTarget(null);
      await load();
      setNotice('Data berhasil dihapus / dinonaktifkan.');
    } catch (err) {
      setError(ngajiError(err, 'Gagal memproses data.'));
    } finally {
      setIsSaving(false);
    }
  }

  // JIKA FORM AKTIF TERBUKA, TAMPILKAN COMPLEX NGAJI FORM (IN-PAGE MULTI-STEP FORM)
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
      key: 'kitab',
      header: 'Kitab & Pengajar',
      sortable: true,
      sortValue: (row) => String(row.kitab ?? ''),
      render: (row) => {
        const cover = getBookCover(String(row.kitab_code || row.ngaji_book_id || row.kitab));
        return (
          <div className="flex items-center gap-3">
            {cover ? (
              <img src={cover} alt="Cover" className="h-10 w-8 rounded-lg object-cover shadow-xs border border-slate-200" />
            ) : (
              <div className="flex h-10 w-9 items-center justify-center rounded-xl bg-teal-50 text-[#138F81] font-bold border border-teal-100">
                <BookOpen size={16} />
              </div>
            )}
            <div>
              <p className="font-extrabold text-slate-800 text-sm">{text(row.kitab)}</p>
              <p className="text-xs font-semibold text-[#138F81]">{text(row.pengajar, 'Ustadz Pengajar')}</p>
            </div>
          </div>
        );
      }
    },
    {
      key: 'sesi',
      header: 'Sesi & Waktu',
      sortable: true,
      sortValue: (row) => String(row.start_time ?? row.sesi ?? ''),
      render: (row) => (
        <div>
          <p className="font-extrabold text-slate-800 text-xs">{text(row.sesi)}</p>
          <p className="text-[11px] font-mono text-slate-500">{text(row.start_time, '--:--')} - {text(row.end_time, '--:--')} WIB</p>
        </div>
      )
    },
    {
      key: 'target',
      header: 'Target Santri',
      sortable: true,
      sortValue: (row) => String(row.kamar ?? row.komplek ?? row.kelas ?? ''),
      render: (row) => (
        <span className="inline-flex items-center gap-1 rounded-lg bg-slate-100 px-2.5 py-1 text-xs font-extrabold text-slate-700">
          <UsersRound size={12} /> {text(row.kamar ?? row.komplek ?? row.kelas, 'Semua Santri')}
        </span>
      )
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
      render: (row) => {
        const bookData = books.find((b) => num(b.id) === num(row.ngaji_book_id)) || {
          id: row.ngaji_book_id,
          name: row.kitab,
        };
        return (
          <div className="flex gap-2 justify-end">
            <button
              className="rounded-xl bg-[#EAF4FF] px-3.5 py-2 text-xs font-extrabold text-[#2E86DE] hover:bg-[#d8ecff] transition-colors inline-flex items-center gap-1.5"
              type="button"
              onClick={() => setActiveFormData(bookData)}
            >
              <Pencil size={13} /> Edit & Atur Jadwal
            </button>
            <button
              className="rounded-xl bg-[#FDECEC] px-3.5 py-2 text-xs font-extrabold text-[#D63031] hover:bg-[#fad4d4] transition-colors inline-flex items-center gap-1.5"
              type="button"
              onClick={() => setDeleteTarget({ type: 'schedule', row })}
            >
              <Trash2 size={13} /> Hapus
            </button>
          </div>
        );
      }
    }
  ];

  return (
    <div className="space-y-6">
      <Message error={error} notice={notice} />

      {/* STAT CARDS */}
      <div className="grid gap-4 sm:grid-cols-3">
        <div className="rounded-3xl bg-white p-4.5 border border-slate-100 shadow-xs flex items-center gap-3.5">
          <div className="h-12 w-12 rounded-2xl bg-teal-50 border border-teal-100 flex items-center justify-center text-[#138F81] font-black">
            <BookOpen size={24} />
          </div>
          <div>
            <p className="text-xs font-bold text-slate-400">Master Kitab Kajian</p>
            <p className="text-xl font-black text-slate-800">{books.length} Kitab</p>
          </div>
        </div>

        <div className="rounded-3xl bg-white p-4.5 border border-slate-100 shadow-xs flex items-center gap-3.5">
          <div className="h-12 w-12 rounded-2xl bg-amber-50 border border-amber-100 flex items-center justify-center text-amber-700 font-black">
            <CalendarDays size={24} />
          </div>
          <div>
            <p className="text-xs font-bold text-slate-400">Jadwal Pengajian Aktif</p>
            <p className="text-xl font-black text-amber-800">{schedules.length} Jadwal</p>
          </div>
        </div>

        <div className="rounded-3xl bg-white p-4.5 border border-slate-100 shadow-xs flex items-center gap-3.5">
          <div className="h-12 w-12 rounded-2xl bg-blue-50 border border-blue-100 flex items-center justify-center text-blue-700 font-black">
            <Clock3 size={24} />
          </div>
          <div>
            <p className="text-xs font-bold text-slate-400">Sesi Waktu Ngaji</p>
            <p className="text-xl font-black text-blue-800">{sessions.length} Sesi</p>
          </div>
        </div>
      </div>

      {/* ACTION BAR */}
      <section className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-4 sm:p-5 rounded-3xl border border-slate-100 shadow-xs">
        <div className="flex flex-1 flex-wrap items-center gap-2.5">
          <div className="flex-1 min-w-[240px]">
            <SearchInput
              value={searchSchedule}
              onChange={setSearchSchedule}
              placeholder="Cari nama kitab / ustadz / sesi / kamar / hari..."
            />
          </div>

          <div className="inline-flex items-center gap-1 p-1 bg-slate-100 rounded-2xl border border-slate-200 shrink-0">
            <button
              type="button"
              onClick={() => setStatusFilter('all')}
              className={`px-3 py-1.5 rounded-xl text-xs font-extrabold transition-all ${
                statusFilter === 'all'
                  ? 'bg-white text-slate-800 shadow-xs ring-1 ring-black/5'
                  : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              Semua ({schedules.length})
            </button>
            <button
              type="button"
              onClick={() => setStatusFilter('Aktif')}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-extrabold transition-all ${
                statusFilter === 'Aktif'
                  ? 'bg-[#138F81] text-white shadow-xs'
                  : 'text-slate-600 hover:text-[#138F81]'
              }`}
            >
              <span className={`h-2 w-2 rounded-full ${statusFilter === 'Aktif' ? 'bg-white' : 'bg-emerald-500'}`} />
              Aktif ({activeCount})
            </button>
            <button
              type="button"
              onClick={() => setStatusFilter('Nonaktif')}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-extrabold transition-all ${
                statusFilter === 'Nonaktif'
                  ? 'bg-slate-700 text-white shadow-xs'
                  : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              <span className={`h-2 w-2 rounded-full ${statusFilter === 'Nonaktif' ? 'bg-white' : 'bg-slate-400'}`} />
              Nonaktif ({inactiveCount})
            </button>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            className="inline-flex min-h-11 items-center gap-2 rounded-2xl bg-[#138F81] px-4.5 text-sm font-extrabold text-white shadow-md shadow-[#138F81]/20 hover:brightness-105 transition-all"
            type="button"
            onClick={() => setActiveFormData(null)}
          >
            <Plus size={17} /> Tambah Kitab & Jadwal Ngaji
          </button>
          <RefreshButton isLoading={isLoading} onClick={() => void load(true)} />
        </div>
      </section>

      {/* TABLE JADWAL NGAJI */}
      <section className="q-table-container rounded-3xl bg-white p-4 shadow-sm md:p-6 lg:p-8">
        <div className="mb-4">
          <h2 className="text-lg font-extrabold text-slate-800">Daftar Jadwal Pengajian Santri</h2>
          <p className="text-xs font-semibold text-slate-500">Susunan kitab, waktu sesi, ustadz pengajar, dan target kamar/komplek.</p>
        </div>
        {isLoading ? (
          <LoadingText text="Memuat susunan jadwal ngaji..." />
        ) : (
          <DataTable
            rows={filteredSchedules}
            columns={scheduleColumns}
            defaultSortKey="kitab"
            defaultSortDirection="asc"
            emptyText={
              statusFilter === 'Aktif'
                ? 'Tidak ada jadwal pengajian yang aktif.'
                : statusFilter === 'Nonaktif'
                ? 'Tidak ada jadwal pengajian yang nonaktif.'
                : 'Belum ada jadwal ngaji santri yang dibuat.'
            }
            minWidth="860px"
          />
        )}
      </section>


      {/* MASTER LIST KITAB DENGAN FOTO */}
      <section className="rounded-3xl bg-white p-6 border border-slate-100 shadow-xs space-y-4">
        <div className="flex items-center justify-between border-b border-slate-100 pb-4">
          <div>
            <h3 className="text-lg font-extrabold text-[#2D3436] flex items-center gap-2">
              <BookOpen className="text-[#138F81]" size={20} />
              Daftar Master Kitab Pengajian ({books.length})
            </h3>
            <p className="text-xs font-semibold text-[#636E72]">
              Kitab yang diajarkan dalam pengajian wetonan, sorogan, dan maknani.
            </p>
          </div>
          <button
            className="rounded-2xl bg-teal-50 px-3.5 py-2 text-xs font-extrabold text-[#138F81] hover:bg-teal-100 transition-colors inline-flex items-center gap-1.5"
            onClick={() => setActiveFormData(null)}
            type="button"
          >
            <Plus size={15} /> Tambah Kitab Baru
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5">
          {books.map((b) => {
            const cover = getBookCover(String(b.code || b.id || b.name));
            return (
              <div key={text(b.id)} className="rounded-2xl bg-slate-50/70 p-3.5 border border-slate-100 flex items-center justify-between gap-3 hover:bg-white hover:shadow-xs transition-all">
                <div className="flex items-center gap-3 overflow-hidden">
                  {cover ? (
                    <img src={cover} alt="Kitab" className="h-12 w-10 rounded-xl object-cover border border-slate-200 shrink-0 shadow-xs" />
                  ) : (
                    <div className="h-12 w-10 rounded-xl bg-teal-100/70 border border-teal-200 flex items-center justify-center text-[#138F81] shrink-0 font-black">
                      <BookOpen size={18} />
                    </div>
                  )}
                  <div className="truncate">
                    <p className="font-extrabold text-slate-800 text-sm truncate">{text(b.name)}</p>
                    <p className="text-xs font-semibold text-[#138F81]">{text(b.method, 'Maknani')}</p>
                    <p className="text-[11px] font-mono text-slate-400">Kode: {text(b.code)}</p>
                  </div>
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  <button
                    className="rounded-xl bg-white px-3 py-1.5 text-xs font-extrabold text-blue-600 hover:bg-blue-50 shadow-2xs border border-slate-200 transition-colors inline-flex items-center gap-1"
                    onClick={() => setActiveFormData(b)}
                    type="button"
                    title="Edit & Atur Jadwal Kitab"
                  >
                    <Pencil size={13} /> Edit
                  </button>
                  <button
                    className="rounded-xl bg-rose-50 p-2 text-rose-600 hover:bg-rose-100 transition-colors"
                    onClick={() => setDeleteTarget({ type: 'book', row: b })}
                    type="button"
                    title="Hapus Kitab"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* CONFIRM DELETE DIALOG */}
      {deleteTarget ? (
        <ConfirmDialog
          title={deleteTarget.type === 'book' ? 'Hapus Kitab Ngaji' : 'Hapus Jadwal Ngaji'}
          message="Data lama tetap aman. Riwayat absensi santri yang sudah tersimpan tidak akan terganggu."
          tone="danger"
          isBusy={isSaving}
          onCancel={() => setDeleteTarget(null)}
          onConfirm={() => void deactivate()}
        />
      ) : null}
    </div>
  );
}

/**
 * Form Fields untuk Tambah / Edit Kitab Ngaji + Foto Cover Kitab (Offline Client Storage)
 */
function AttendanceRows({
  rows: studentRows,
  isLoading,
  statuses,
  onChange
}: {
  rows: ApiRecord[];
  isLoading: boolean;
  statuses: Record<number, NgajiStatus>;
  onChange: (id: number, status: NgajiStatus) => void;
}) {
  if (isLoading) return <LoadingText text="Memuat daftar santri ngaji..." />;
  if (studentRows.length === 0) return <div className="q-card px-4 py-8 text-center text-sm font-bold text-[#636E72]">Belum ada santri pada jadwal ngaji ini.</div>;

  return (
    <section className="space-y-3">
      {studentRows.map((student, index) => {
        const id = num(student.id);
        const status = statuses[id] ?? '';
        return (
          <div key={id} className="q-card flex flex-wrap items-center gap-4 p-4">
            <span className="grid h-12 w-12 place-items-center rounded-2xl bg-[#E8F7F3] text-sm font-extrabold text-[#138F81]">{index + 1}</span>
            <div className="min-w-[220px] flex-1">
              <p className="text-base font-extrabold text-[#2D3436]">{text(student.nama)}</p>
              <p className="text-sm font-semibold text-[#636E72]">{text(student.kelas)} - {text(student.komplek)} / {text(student.kamar)}</p>
              <div className="mt-2"><StatusBadge label={statusLabels[status]} tone={statusTone(status)} /></div>
            </div>
            <div className="flex flex-wrap gap-2">
              {(['H', 'I', 'S', 'A'] as NgajiStatus[]).map((option) => (
                <button key={option} className={`grid h-12 min-w-12 place-items-center rounded-2xl px-3 text-sm font-extrabold transition ${status === option ? 'bg-[#138F81] text-white' : 'bg-[#F7FBFC] text-[#138F81] hover:bg-[#E1EFF7]'}`} onClick={() => onChange(id, option)} type="button">
                  {option}
                </button>
              ))}
            </div>
          </div>
        );
      })}
    </section>
  );
}

function RefreshButton({ isLoading, onClick }: { isLoading: boolean; onClick: () => void }) {
  return (
    <button className={`q-refresh-button flex min-h-11 items-center justify-center gap-2 rounded-2xl bg-white px-4 text-sm font-bold text-[#138F81] border border-slate-200/70 shadow-2xs ${isLoading ? 'is-loading' : ''}`} onClick={onClick} type="button" disabled={isLoading}>
      <RefreshCw className="q-refresh-icon" size={17} />
      {isLoading ? 'Menyegarkan...' : 'Refresh'}
    </button>
  );
}

function Message({ error, notice }: { error?: string; notice?: string }) {
  return (
    <>
      {error ? <div className="rounded-2xl bg-[#FDECEC] px-4 py-3 text-sm font-bold text-[#D63031] border border-rose-100 flex items-center gap-2"><span>⚠️</span> {error}</div> : null}
      {notice ? <div className="rounded-2xl bg-[#E8F7F3] px-4 py-3 text-sm font-bold text-[#138F81] border border-teal-100 flex items-center gap-2"><span>✅</span> {notice}</div> : null}
    </>
  );
}

function LoadingText({ text: label }: { text: string }) {
  return <div className="q-card px-4 py-8 text-center text-sm font-bold text-[#636E72]">{label}</div>;
}
