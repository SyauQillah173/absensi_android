import { BookOpenCheck, CalendarDays, Download, Edit3, Plus, RefreshCw, Save, Trash2 } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { useAuth } from '../auth/AuthContext';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { DataTable, type DataColumn } from '../components/DataTable';
import { ModalForm } from '../components/ModalForm';
import { SearchInput } from '../components/SearchInput';
import { SegmentedTabs } from '../components/SegmentedTabs';
import { StatCard } from '../components/StatCard';
import { StatusBadge } from '../components/StatusBadge';
import { api, type ApiRecord } from '../services/api';
import { exportNgajiRekapExcel } from '../utils/excel';

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
  return new Date().toISOString().slice(0, 10);
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
    return 'Fitur Absensi Ngaji menunggu backend terbaru. Deploy backend terbaru lalu jalankan migrasi database agar master ngaji aktif di web dan Android.';
  }
  return message || fallback;
}

export function NgajiKitabSection() {
  const [activeTab, setActiveTab] = useState<NgajiTab>('input');

  return (
    <div className="space-y-6">
      <SegmentedTabs
        tabs={[
          { id: 'input', label: 'Absensi Ngaji' },
          { id: 'rekap', label: 'Rekap Ngaji' },
          { id: 'master', label: 'Master Ngaji' }
        ]}
        active={activeTab}
        onChange={(id) => setActiveTab(id as NgajiTab)}
      />
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
        <input className="q-input" type="date" value={date} onChange={(event) => setDate(event.target.value)} />
        <select className="q-input" value={scheduleId} onChange={(event) => setScheduleId(Number(event.target.value))}>
          <option value={0}>Pilih jadwal ngaji</option>
          {schedules.map((schedule) => (
            <option key={text(schedule.id)} value={text(schedule.id)}>
              {text(schedule.sesi)} - {text(schedule.kitab)} - {text(schedule.kamar ?? schedule.kelas ?? schedule.komplek, 'Semua santri')}
            </option>
          ))}
        </select>
        <RefreshButton isLoading={isLoading} onClick={() => void loadContext()} />
      </section>
      <div className="grid gap-4 md:grid-cols-4">
        <StatCard title="Hadir" value={num(summary.H)} subtitle="Status H" icon={BookOpenCheck} tone="teal" />
        <StatCard title="Izin" value={num(summary.I)} subtitle="Status I" icon={CalendarDays} tone="orange" />
        <StatCard title="Sakit" value={num(summary.S)} subtitle="Status S" icon={CalendarDays} tone="red" />
        <StatCard title="Belum" value={num(summary.kosong)} subtitle="Belum dipilih" icon={CalendarDays} tone="blue" />
      </div>
      <AttendanceRows rows={studentRows} isLoading={isLoading} statuses={statuses} onChange={(id, status) => setStatuses((current) => ({ ...current, [id]: status }))} />
      <div className="q-panel q-save-bar flex flex-wrap items-center justify-end gap-3 p-4">
        <button className="q-soft-action q-save-secondary min-h-12 rounded-2xl bg-white px-5 text-sm font-extrabold text-[#636E72]" type="button" onClick={() => setStatuses({})} disabled={isSaving}>
          Reset Pilihan
        </button>
        <button className="q-soft-action q-save-primary flex min-h-12 items-center gap-2 rounded-2xl bg-[#138F81] px-6 text-sm font-extrabold text-white disabled:opacity-60" type="button" onClick={() => void save()} disabled={isSaving || studentRows.length === 0}>
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
    const keyword = search.toLowerCase();
    if (!keyword) return rowsData;
    return rowsData.filter((row) => JSON.stringify(row).toLowerCase().includes(keyword));
  }, [rowsData, search]);

  const columns: DataColumn<ApiRecord>[] = [
    { key: 'siswa', header: 'Siswa', render: (row) => <span className="font-extrabold">{text(row.nama)}</span> },
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
        <input className="q-input" value={month} onChange={(event) => setMonth(event.target.value)} placeholder="Bulan" />
        <input className="q-input" value={year} onChange={(event) => setYear(event.target.value)} placeholder="Tahun" />
        <SearchInput value={search} onChange={setSearch} placeholder="Cari siswa / kelas / kitab" />
        <button className="q-soft-action q-rekap-button inline-flex min-h-12 items-center justify-center gap-2 rounded-2xl bg-white px-4 text-sm font-extrabold text-[#138F81]" type="button" onClick={() => exportNgajiRekapExcel(records, summary, 'rekap_ngaji_qomaruddin.xlsx')} disabled={records.length === 0}>
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
  const [teachers, setTeachers] = useState<ApiRecord[]>([]);
  const [complexes, setComplexes] = useState<ApiRecord[]>([]);
  const [classes, setClasses] = useState<ApiRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [form, setForm] = useState<{ type: 'session' | 'book' | 'schedule'; data: ApiRecord } | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<{ type: 'session' | 'book' | 'schedule'; row: ApiRecord } | null>(null);

  async function load() {
    setIsLoading(true);
    setError('');
    try {
      const [sessionResult, bookResult, scheduleResult, teacherResult, complexResult, classResult] = await Promise.all([
        api.ngajiSessions(),
        api.ngajiBooks(),
        api.ngajiSchedules(),
        api.users({ role: 'guru', status: 'Aktif' }),
        api.boardingComplexes(),
        api.classes()
      ]);
      setSessions(rows(sessionResult.data));
      setBooks(rows(bookResult.data));
      setSchedules(rows(scheduleResult.data));
      setTeachers(rows(teacherResult.data));
      setComplexes(rows(complexResult.data));
      setClasses(rows(classResult.data));
    } catch (err) {
      setError(ngajiError(err, 'Master ngaji gagal dimuat.'));
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  async function save() {
    if (!form) return;
    setIsSaving(true);
    setError('');
    setNotice('');
    try {
      const id = num(form.data.id);
      if (form.type === 'session') {
        id ? await api.updateNgajiSession(id, form.data) : await api.createNgajiSession(form.data);
      } else if (form.type === 'book') {
        id ? await api.updateNgajiBook(id, form.data) : await api.createNgajiBook(form.data);
      } else {
        const payload = { ...form.data };
        id ? await api.updateNgajiSchedule(id, payload) : await api.createNgajiSchedule(payload);
      }
      setForm(null);
      await load();
      setNotice('Master ngaji berhasil disimpan.');
    } catch (err) {
      setError(ngajiError(err, 'Master ngaji gagal disimpan.'));
    } finally {
      setIsSaving(false);
    }
  }

  async function deactivate() {
    if (!deleteTarget) return;
    setIsSaving(true);
    setError('');
    setNotice('');
    try {
      const id = num(deleteTarget.row.id);
      if (deleteTarget.type === 'session') await api.deleteNgajiSession(id);
      if (deleteTarget.type === 'book') await api.deleteNgajiBook(id);
      if (deleteTarget.type === 'schedule') await api.deleteNgajiSchedule(id);
      setDeleteTarget(null);
      await load();
      setNotice('Master ngaji berhasil dinonaktifkan.');
    } catch (err) {
      setError(ngajiError(err, 'Master ngaji gagal dinonaktifkan.'));
    } finally {
      setIsSaving(false);
    }
  }

  const scheduleColumns: DataColumn<ApiRecord>[] = [
    { key: 'sesi', header: 'Sesi', render: (row) => text(row.sesi) },
    { key: 'kitab', header: 'Kitab', render: (row) => text(row.kitab) },
    { key: 'pengajar', header: 'Pengajar', render: (row) => text(row.pengajar) },
    { key: 'target', header: 'Target', render: (row) => text(row.kamar ?? row.komplek ?? row.kelas, 'Semua santri') },
    { key: 'status', header: 'Status', render: (row) => <StatusBadge label={text(row.status)} tone={statusTone(text(row.status))} /> },
    {
      key: 'aksi',
      header: 'Aksi',
      render: (row) => (
        <div className="flex gap-2">
          <button className="q-soft-action rounded-xl bg-[#EAF4FF] px-3 py-2 text-xs font-extrabold text-[#2E86DE]" type="button" onClick={() => setForm({ type: 'schedule', data: row })}>
            Edit
          </button>
          <button className="q-soft-action rounded-xl bg-[#FDECEC] px-3 py-2 text-xs font-extrabold text-[#D63031]" type="button" onClick={() => setDeleteTarget({ type: 'schedule', row })}>
            Nonaktifkan
          </button>
        </div>
      )
    }
  ];

  return (
    <div className="space-y-5">
      <Message error={error} notice={notice} />
      <div className="grid gap-4 md:grid-cols-3">
        <StatCard title="Sesi Ngaji" value={sessions.length} subtitle="Pagi, sore, atau tambahan" icon={CalendarDays} tone="teal" />
        <StatCard title="Kitab" value={books.length} subtitle="Master kitab/pelajaran" icon={BookOpenCheck} tone="blue" />
        <StatCard title="Jadwal" value={schedules.length} subtitle="Target santri dan pengajar" icon={CalendarDays} tone="orange" />
      </div>
      <section className="q-panel flex flex-wrap gap-2 p-4">
        <button className="q-soft-action inline-flex min-h-11 items-center gap-2 rounded-2xl bg-[#138F81] px-4 text-sm font-extrabold text-white" type="button" onClick={() => setForm({ type: 'session', data: { is_active: true, sort_order: 0 } })}>
          <Plus size={17} /> Tambah Sesi
        </button>
        <button className="q-soft-action inline-flex min-h-11 items-center gap-2 rounded-2xl bg-[#138F81] px-4 text-sm font-extrabold text-white" type="button" onClick={() => setForm({ type: 'book', data: { is_active: true, sort_order: 0, method: 'Maknani' } })}>
          <Plus size={17} /> Tambah Kitab
        </button>
        <button className="q-soft-action inline-flex min-h-11 items-center gap-2 rounded-2xl bg-[#138F81] px-4 text-sm font-extrabold text-white" type="button" onClick={() => setForm({ type: 'schedule', data: { status: 'Aktif' } })}>
          <Plus size={17} /> Tambah Jadwal
        </button>
        <RefreshButton isLoading={isLoading} onClick={() => void load()} />
      </section>
      <section className="q-panel p-4 sm:p-6">
        {isLoading ? <LoadingText text="Memuat master ngaji..." /> : <DataTable rows={schedules} columns={scheduleColumns} emptyText="Belum ada jadwal ngaji." minWidth="860px" />}
      </section>
      <section className="grid gap-4 lg:grid-cols-2">
        <MasterList title="Sesi Ngaji" rows={sessions} type="session" onEdit={(row) => setForm({ type: 'session', data: row })} onDelete={(row) => setDeleteTarget({ type: 'session', row })} />
        <MasterList title="Kitab Ngaji" rows={books} type="book" onEdit={(row) => setForm({ type: 'book', data: row })} onDelete={(row) => setDeleteTarget({ type: 'book', row })} />
      </section>

      {form ? (
        <ModalForm
          title={formTitle(form.type, num(form.data.id) > 0)}
          onClose={() => setForm(null)}
          footer={
            <button className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-2xl bg-[#138F81] px-5 text-sm font-extrabold text-white disabled:opacity-60" type="button" onClick={() => void save()} disabled={isSaving}>
              <Save size={17} /> {isSaving ? 'Menyimpan...' : 'Simpan'}
            </button>
          }
        >
          {form.type === 'schedule' ? (
            <ScheduleForm data={form.data} setData={(data) => setForm({ ...form, data })} sessions={sessions} books={books} teachers={teachers} complexes={complexes} classes={classes} />
          ) : (
            <MasterForm data={form.data} setData={(data) => setForm({ ...form, data })} type={form.type} />
          )}
        </ModalForm>
      ) : null}

      {deleteTarget ? (
        <ConfirmDialog
          title="Nonaktifkan Master Ngaji"
          message="Data lama tetap aman, master ini tidak muncul pada input baru."
          tone="danger"
          isBusy={isSaving}
          onCancel={() => setDeleteTarget(null)}
          onConfirm={() => void deactivate()}
        />
      ) : null}
    </div>
  );
}

function MasterList({ title, rows: itemRows, onEdit, onDelete }: { title: string; rows: ApiRecord[]; type: string; onEdit: (row: ApiRecord) => void; onDelete: (row: ApiRecord) => void }) {
  return (
    <section className="q-panel p-4">
      <h3 className="mb-3 text-lg font-extrabold text-[#2D3436]">{title}</h3>
      <div className="space-y-2">
        {itemRows.length === 0 ? <div className="q-card p-4 text-sm font-bold text-[#636E72]">Belum ada data.</div> : null}
        {itemRows.map((row) => (
          <div key={text(row.id)} className="q-card flex flex-wrap items-center justify-between gap-3 p-3">
            <div>
              <p className="font-extrabold text-[#2D3436]">{text(row.name)}</p>
              <p className="text-xs font-semibold text-[#636E72]">{text(row.code)} {row.method ? `- ${text(row.method)}` : ''}</p>
            </div>
            <div className="flex gap-2">
              <StatusBadge label={row.is_active === false ? 'Nonaktif' : 'Aktif'} tone={row.is_active === false ? 'danger' : 'success'} />
              <button className="q-soft-action rounded-xl bg-[#EAF4FF] px-3 py-2 text-xs font-extrabold text-[#2E86DE]" onClick={() => onEdit(row)} type="button">
                <Edit3 size={14} />
              </button>
              <button className="q-soft-action rounded-xl bg-[#FDECEC] px-3 py-2 text-xs font-extrabold text-[#D63031]" onClick={() => onDelete(row)} type="button">
                <Trash2 size={14} />
              </button>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

function MasterForm({ data, setData, type }: { data: ApiRecord; setData: (data: ApiRecord) => void; type: 'session' | 'book' }) {
  return (
    <div className="grid gap-4">
      <input className="q-input" value={text(data.name, '')} onChange={(event) => setData({ ...data, name: event.target.value })} placeholder={type === 'session' ? 'Nama sesi, contoh: Ngaji Pagi' : 'Nama kitab, contoh: Fathul Qorib'} />
      <input className="q-input" value={text(data.code, '')} onChange={(event) => setData({ ...data, code: event.target.value })} placeholder="Kode unik, boleh dikosongi otomatis" />
      {type === 'book' ? <input className="q-input" value={text(data.method, '')} onChange={(event) => setData({ ...data, method: event.target.value })} placeholder="Metode, contoh: Maknani" /> : null}
      {type === 'session' ? (
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="grid gap-2">
            <span className="text-xs font-extrabold text-[#636E72]">Jam mulai sesi</span>
            <input className="q-input" type="time" value={text(data.start_time, '')} onChange={(event) => setData({ ...data, start_time: event.target.value })} aria-label="Jam mulai sesi" />
          </label>
          <label className="grid gap-2">
            <span className="text-xs font-extrabold text-[#636E72]">Jam selesai sesi</span>
            <input className="q-input" type="time" value={text(data.end_time, '')} onChange={(event) => setData({ ...data, end_time: event.target.value })} aria-label="Jam selesai sesi" />
          </label>
        </div>
      ) : null}
      <textarea className="q-input min-h-24 resize-none" value={text(data.description, '')} onChange={(event) => setData({ ...data, description: event.target.value })} placeholder="Keterangan opsional" />
      <input className="q-input" inputMode="numeric" value={text(data.sort_order, '0')} onChange={(event) => setData({ ...data, sort_order: Number(event.target.value) })} placeholder="Urutan tampil" />
      <label className="flex items-center justify-between rounded-2xl bg-white px-4 py-3 text-sm font-extrabold text-[#2D3436]">
        Aktif
        <input type="checkbox" checked={data.is_active !== false} onChange={(event) => setData({ ...data, is_active: event.target.checked })} />
      </label>
    </div>
  );
}

function ScheduleForm({ data, setData, sessions, books, teachers, complexes, classes }: { data: ApiRecord; setData: (data: ApiRecord) => void; sessions: ApiRecord[]; books: ApiRecord[]; teachers: ApiRecord[]; complexes: ApiRecord[]; classes: ApiRecord[] }) {
  const selectedComplex = complexes.find((row) => num(row.id) === num(data.boarding_complex_id));
  const roomRows = rows(record(selectedComplex).rooms);
  return (
    <div className="grid gap-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <select className="q-input" value={text(data.ngaji_session_id, '')} onChange={(event) => setData({ ...data, ngaji_session_id: Number(event.target.value) })}>
          <option value="">Pilih sesi</option>
          {sessions.map((row) => <option key={text(row.id)} value={text(row.id)}>{text(row.name)}</option>)}
        </select>
        <select className="q-input" value={text(data.ngaji_book_id, '')} onChange={(event) => setData({ ...data, ngaji_book_id: Number(event.target.value) })}>
          <option value="">Pilih kitab</option>
          {books.map((row) => <option key={text(row.id)} value={text(row.id)}>{text(row.name)}</option>)}
        </select>
      </div>
      <select className="q-input" value={text(data.teacher_id, '')} onChange={(event) => setData({ ...data, teacher_id: event.target.value ? Number(event.target.value) : null })}>
        <option value="">Pilih pengajar opsional</option>
        {teachers.map((row) => <option key={text(row.id)} value={text(row.id)}>{text(row.name)}</option>)}
      </select>
      <div className="grid gap-4 sm:grid-cols-3">
        <select className="q-input" value={text(data.boarding_complex_id, '')} onChange={(event) => setData({ ...data, boarding_complex_id: event.target.value ? Number(event.target.value) : null, boarding_room_id: null })}>
          <option value="">Komplek opsional</option>
          {complexes.map((row) => <option key={text(row.id)} value={text(row.id)}>{text(row.name)}</option>)}
        </select>
        <select className="q-input" value={text(data.boarding_room_id, '')} onChange={(event) => setData({ ...data, boarding_room_id: event.target.value ? Number(event.target.value) : null })}>
          <option value="">Kamar opsional</option>
          {roomRows.map((row) => <option key={text(row.id)} value={text(row.id)}>{text(row.name)}</option>)}
        </select>
        <select className="q-input" value={text(data.class_id, '')} onChange={(event) => setData({ ...data, class_id: event.target.value ? Number(event.target.value) : null })}>
          <option value="">Kelas opsional</option>
          {classes.map((row) => <option key={text(row.id)} value={text(row.id)}>{text(row.name)}</option>)}
        </select>
      </div>
      <div className="grid gap-4 sm:grid-cols-3">
        <label className="grid gap-2">
          <span className="text-xs font-extrabold text-[#636E72]">Jam mulai</span>
          <input className="q-input" type="time" value={text(data.start_time, '')} onChange={(event) => setData({ ...data, start_time: event.target.value })} aria-label="Jam mulai jadwal ngaji" />
        </label>
        <label className="grid gap-2">
          <span className="text-xs font-extrabold text-[#636E72]">Jam selesai</span>
          <input className="q-input" type="time" value={text(data.end_time, '')} onChange={(event) => setData({ ...data, end_time: event.target.value })} aria-label="Jam selesai jadwal ngaji" />
        </label>
        <select className="q-input" value={text(data.status, 'Aktif')} onChange={(event) => setData({ ...data, status: event.target.value })}>
          <option value="Aktif">Aktif</option>
          <option value="Nonaktif">Nonaktif</option>
        </select>
      </div>
      <textarea className="q-input min-h-24 resize-none" value={text(data.description, '')} onChange={(event) => setData({ ...data, description: event.target.value })} placeholder="Keterangan jadwal opsional" />
    </div>
  );
}

function AttendanceRows({ rows: studentRows, isLoading, statuses, onChange }: { rows: ApiRecord[]; isLoading: boolean; statuses: Record<number, NgajiStatus>; onChange: (id: number, status: NgajiStatus) => void }) {
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
    <button className={`q-refresh-button flex min-h-12 items-center justify-center gap-2 rounded-2xl bg-white px-4 text-sm font-bold text-[#138F81] ${isLoading ? 'is-loading' : ''}`} onClick={onClick} type="button" disabled={isLoading}>
      <RefreshCw className="q-refresh-icon" size={17} />
      {isLoading ? 'Menyegarkan...' : 'Refresh'}
    </button>
  );
}

function Message({ error, notice }: { error?: string; notice?: string }) {
  return (
    <>
      {error ? <div className="rounded-2xl bg-[#FDECEC] px-4 py-3 text-sm font-bold text-[#D63031]">{error}</div> : null}
      {notice ? <div className="rounded-2xl bg-[#E8F7F3] px-4 py-3 text-sm font-bold text-[#138F81]">{notice}</div> : null}
    </>
  );
}

function LoadingText({ text: label }: { text: string }) {
  return <div className="q-card px-4 py-8 text-center text-sm font-bold text-[#636E72]">{label}</div>;
}

function formTitle(type: 'session' | 'book' | 'schedule', edit: boolean): string {
  const label = type === 'session' ? 'Sesi Ngaji' : type === 'book' ? 'Kitab Ngaji' : 'Jadwal Ngaji';
  return `${edit ? 'Edit' : 'Tambah'} ${label}`;
}
