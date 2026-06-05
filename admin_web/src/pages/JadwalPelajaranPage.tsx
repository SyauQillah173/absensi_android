import { CalendarCheck, Clock3, Pencil, Plus, RefreshCw, Search, Trash2, UsersRound } from 'lucide-react';
import { FormEvent, useEffect, useMemo, useState } from 'react';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { DataTable, type DataColumn } from '../components/DataTable';
import { ModalForm } from '../components/ModalForm';
import { SearchInput } from '../components/SearchInput';
import { StatCard } from '../components/StatCard';
import { StatusBadge } from '../components/StatusBadge';
import { api, type ApiRecord } from '../services/api';

interface JadwalFormState {
  id?: number;
  hari: string;
  jam_mulai: string;
  jam_selesai: string;
  mapel_id: string;
  teacher_id: string;
  class_id: string;
  sifir: string;
  ruangan: string;
  status: 'Aktif' | 'Nonaktif';
}

const days = ['Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu', 'Ahad'];

function text(value: unknown, fallback = '-'): string {
  const clean = String(value ?? '').trim();
  return clean || fallback;
}

function optional(value: unknown): string {
  const clean = text(value, '');
  return clean === '-' ? '' : clean;
}

function num(value: unknown): number {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function record(value: unknown): ApiRecord {
  return value && typeof value === 'object' && !Array.isArray(value) ? (value as ApiRecord) : {};
}

function newForm(row?: ApiRecord): JadwalFormState {
  return {
    id: row?.id ? num(row.id) : undefined,
    hari: optional(row?.hari ?? row?.day) || 'Senin',
    jam_mulai: optional(row?.jam_mulai ?? row?.start_time),
    jam_selesai: optional(row?.jam_selesai ?? row?.end_time),
    mapel_id: optional(row?.mapel_id ?? record(row?.mata_pelajaran).id),
    teacher_id: optional(row?.teacher_id ?? record(row?.teacher).id),
    class_id: optional(row?.class_id ?? record(row?.class).id),
    sifir: optional(row?.sifir ?? row?.kelas ?? record(row?.class).nama),
    ruangan: optional(row?.ruangan ?? row?.room),
    status: text(row?.status, 'Aktif') === 'Nonaktif' ? 'Nonaktif' : 'Aktif'
  };
}

function mapelName(row: ApiRecord): string {
  return text(row.mapel_nama ?? row.mata_pelajaran_nama ?? record(row.mata_pelajaran).nama ?? row.mapel);
}

function guruName(row: ApiRecord): string {
  return text(row.guru_nama ?? row.teacher_name ?? record(row.teacher).name ?? row.guru);
}

function className(row: ApiRecord): string {
  return text(row.class_name ?? row.kelas ?? row.sifir ?? record(row.class).nama ?? record(row.class).name);
}

export function JadwalPelajaranPage() {
  const [rows, setRows] = useState<ApiRecord[]>([]);
  const [mapel, setMapel] = useState<ApiRecord[]>([]);
  const [teachers, setTeachers] = useState<ApiRecord[]>([]);
  const [classes, setClasses] = useState<ApiRecord[]>([]);
  const [search, setSearch] = useState('');
  const [dayFilter, setDayFilter] = useState('Semua');
  const [form, setForm] = useState<JadwalFormState | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<ApiRecord | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  async function load() {
    setIsLoading(true);
    setError('');
    try {
      const [jadwalResult, mapelResult, teacherResult, classResult] = await Promise.all([
        api.jadwal(dayFilter === 'Semua' ? undefined : { hari: dayFilter }),
        api.mataPelajaran({ status: 'Aktif' }),
        api.users({ role: 'guru', status: 'Aktif' }),
        api.classes()
      ]);
      setRows(Array.isArray(jadwalResult.data) ? jadwalResult.data : []);
      setMapel(Array.isArray(mapelResult.data) ? mapelResult.data : []);
      setTeachers(Array.isArray(teacherResult.data) ? teacherResult.data : []);
      setClasses(Array.isArray(classResult.data) ? classResult.data : []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Jadwal pelajaran gagal dimuat.');
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dayFilter]);

  const filtered = useMemo(() => {
    const keyword = search.toLowerCase();
    if (!keyword) return rows;
    return rows.filter((row) => `${mapelName(row)} ${guruName(row)} ${className(row)} ${row.hari ?? ''} ${row.ruangan ?? ''}`.toLowerCase().includes(keyword));
  }, [rows, search]);

  const activeCount = rows.filter((row) => text(row.status, 'Aktif') === 'Aktif').length;
  const classCount = new Set(rows.map((row) => className(row)).filter((value) => value !== '-')).size;

  const columns = useMemo<DataColumn<ApiRecord>[]>(() => [
    { key: 'hari', header: 'Hari', render: (row) => <span className="font-extrabold">{text(row.hari ?? row.day)}</span> },
    { key: 'jam', header: 'Jam', render: (row) => `${text(row.jam_mulai ?? row.start_time)} - ${text(row.jam_selesai ?? row.end_time)}` },
    { key: 'mapel', header: 'Mata Pelajaran', render: (row) => mapelName(row) },
    { key: 'guru', header: 'Guru', render: (row) => guruName(row) },
    { key: 'kelas', header: 'Kelas/Kelompok', render: (row) => className(row) },
    { key: 'ruangan', header: 'Ruangan', render: (row) => text(row.ruangan ?? row.room) },
    { key: 'status', header: 'Status', render: (row) => <StatusBadge label={text(row.status, 'Aktif')} tone={text(row.status, 'Aktif') === 'Aktif' ? 'success' : 'danger'} /> },
    {
      key: 'aksi',
      header: 'Aksi',
      render: (row) => (
        <div className="flex flex-wrap gap-2">
          <button className="rounded-xl bg-[#EAF4FF] px-3 py-2 text-xs font-bold text-[#2E86DE]" onClick={() => setForm(newForm(row))} type="button">
            <Pencil size={14} className="inline" /> Edit
          </button>
          <button className="rounded-xl bg-[#FDECEC] px-3 py-2 text-xs font-bold text-[#D63031]" onClick={() => setDeleteTarget(row)} type="button">
            <Trash2 size={14} className="inline" /> Hapus
          </button>
        </div>
      )
    }
  ], []);

  async function saveForm(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!form || isSaving) return;
    setIsSaving(true);
    setError('');
    try {
      const payload: ApiRecord = {
        hari: form.hari,
        jam_mulai: form.jam_mulai,
        jam_selesai: form.jam_selesai,
        mapel_id: Number(form.mapel_id),
        teacher_id: form.teacher_id ? Number(form.teacher_id) : null,
        class_id: form.class_id ? Number(form.class_id) : null,
        sifir: form.sifir || null,
        ruangan: form.ruangan || null,
        status: form.status
      };
      if (form.id) await api.updateJadwal(form.id, payload);
      else await api.createJadwal(payload);
      setForm(null);
      setNotice('Jadwal pelajaran berhasil disimpan.');
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Jadwal pelajaran gagal disimpan.');
    } finally {
      setIsSaving(false);
    }
  }

  async function deleteJadwal() {
    if (!deleteTarget?.id || isSaving) return;
    setIsSaving(true);
    setError('');
    try {
      await api.deleteJadwal(num(deleteTarget.id));
      setDeleteTarget(null);
      setNotice('Jadwal pelajaran berhasil dihapus.');
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Jadwal pelajaran gagal dihapus.');
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      <section className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm font-bold text-[#636E72]">Akademik</p>
          <h1 className="text-3xl font-extrabold text-[#2D3436]">Jadwal Pelajaran</h1>
          <p className="text-sm font-semibold text-[#636E72]">Jadwal kelas, guru, dan mata pelajaran memakai backend yang sama dengan Android.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button className={`q-refresh-button inline-flex min-h-11 items-center gap-2 rounded-2xl bg-white px-4 text-sm font-bold text-[#138F81] ${isLoading ? 'is-loading' : ''}`} onClick={() => void load()} type="button" disabled={isLoading}>
            <RefreshCw className="q-refresh-icon" size={17} /> {isLoading ? 'Memuat...' : 'Refresh'}
          </button>
          <button className="inline-flex min-h-11 items-center gap-2 rounded-2xl bg-[#138F81] px-4 text-sm font-extrabold text-white shadow-lg shadow-[#138F81]/20" onClick={() => setForm(newForm())} type="button">
            <Plus size={17} /> Tambah Jadwal
          </button>
        </div>
      </section>

      {error ? <div className="rounded-2xl bg-[#FDECEC] px-4 py-3 text-sm font-bold text-[#D63031]">{error}</div> : null}
      {notice ? <div className="rounded-2xl bg-[#E8F7F3] px-4 py-3 text-sm font-bold text-[#138F81]">{notice}</div> : null}

      <div className="grid gap-4 md:grid-cols-3">
        <StatCard title="Total Jadwal" value={rows.length} subtitle={`${activeCount} jadwal aktif`} icon={CalendarCheck} tone="teal" />
        <StatCard title="Kelas Terjadwal" value={classCount} subtitle="Kelompok/kelas terhubung" icon={UsersRound} tone="blue" />
        <StatCard title="Hari Tampil" value={filtered.length} subtitle={dayFilter} icon={Clock3} tone="orange" />
      </div>

      <section className="q-panel p-4 sm:p-6">
        <div className="mb-5 grid gap-3 lg:grid-cols-[1fr_220px]">
          <SearchInput value={search} onChange={setSearch} placeholder="Cari mapel / guru / kelas / ruangan" />
          <select className="q-input" value={dayFilter} onChange={(event) => setDayFilter(event.target.value)}>
            <option value="Semua">Semua hari</option>
            {days.map((day) => <option key={day} value={day}>{day}</option>)}
          </select>
        </div>
        <DataTable
          rows={filtered}
          columns={columns}
          emptyText={isLoading ? 'Memuat jadwal...' : 'Belum ada jadwal pelajaran.'}
          minWidth="980px"
          mobileRender={(row) => (
            <article className="rounded-3xl bg-white p-4 shadow-sm shadow-black/5">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <h3 className="break-words text-base font-extrabold text-[#2D3436]">{mapelName(row)}</h3>
                  <p className="mt-1 text-xs font-semibold text-[#636E72]">{text(row.hari ?? row.day)} - {text(row.jam_mulai ?? row.start_time)} sampai {text(row.jam_selesai ?? row.end_time)}</p>
                </div>
                <StatusBadge label={text(row.status, 'Aktif')} tone={text(row.status, 'Aktif') === 'Aktif' ? 'success' : 'danger'} />
              </div>
              <p className="mt-3 text-xs font-semibold leading-5 text-[#636E72]">Guru: {guruName(row)}</p>
              <p className="text-xs font-semibold text-[#636E72]">Kelas: {className(row)} - Ruangan: {text(row.ruangan ?? row.room)}</p>
              <div className="mt-4 flex flex-wrap gap-2">
                <button className="rounded-xl bg-[#EAF4FF] px-3 py-2 text-xs font-bold text-[#2E86DE]" onClick={() => setForm(newForm(row))} type="button">
                  <Pencil size={14} className="inline" /> Edit
                </button>
                <button className="rounded-xl bg-[#FDECEC] px-3 py-2 text-xs font-bold text-[#D63031]" onClick={() => setDeleteTarget(row)} type="button">
                  <Trash2 size={14} className="inline" /> Hapus
                </button>
              </div>
            </article>
          )}
        />
      </section>

      {form ? (
        <ModalForm
          title={form.id ? 'Edit Jadwal Pelajaran' : 'Tambah Jadwal Pelajaran'}
          onClose={() => setForm(null)}
          footer={
            <button className="min-h-12 w-full rounded-2xl bg-[#138F81] text-sm font-extrabold text-white disabled:opacity-60" disabled={isSaving} form="jadwal-form" type="submit">
              {isSaving ? 'Menyimpan...' : 'Simpan Jadwal'}
            </button>
          }
        >
          <form id="jadwal-form" className="grid gap-4 md:grid-cols-2" onSubmit={saveForm}>
            <label className="block">
              <span className="mb-2 block text-sm font-bold text-[#636E72]">Hari</span>
              <select className="q-input" value={form.hari} onChange={(event) => setForm({ ...form, hari: event.target.value })}>
                {days.map((day) => <option key={day} value={day}>{day}</option>)}
              </select>
            </label>
            <label className="block">
              <span className="mb-2 block text-sm font-bold text-[#636E72]">Mata Pelajaran</span>
              <select className="q-input" value={form.mapel_id} onChange={(event) => setForm({ ...form, mapel_id: event.target.value })} required>
                <option value="">Pilih mata pelajaran</option>
                {mapel.map((item) => <option key={num(item.id)} value={num(item.id)}>{text(item.nama)}</option>)}
              </select>
            </label>
            <label className="block">
              <span className="mb-2 block text-sm font-bold text-[#636E72]">Jam Mulai</span>
              <input className="q-input" type="time" value={form.jam_mulai} onChange={(event) => setForm({ ...form, jam_mulai: event.target.value })} required />
            </label>
            <label className="block">
              <span className="mb-2 block text-sm font-bold text-[#636E72]">Jam Selesai</span>
              <input className="q-input" type="time" value={form.jam_selesai} onChange={(event) => setForm({ ...form, jam_selesai: event.target.value })} required />
            </label>
            <label className="block">
              <span className="mb-2 block text-sm font-bold text-[#636E72]">Guru Pengajar</span>
              <select className="q-input" value={form.teacher_id} onChange={(event) => setForm({ ...form, teacher_id: event.target.value })}>
                <option value="">Pilih guru opsional</option>
                {teachers.map((teacher) => <option key={num(teacher.id)} value={num(teacher.id)}>{text(teacher.name)}</option>)}
              </select>
            </label>
            <label className="block">
              <span className="mb-2 block text-sm font-bold text-[#636E72]">Kelas/Kelompok</span>
              <select className="q-input" value={form.class_id} onChange={(event) => setForm({ ...form, class_id: event.target.value, sifir: '' })}>
                <option value="">Pilih kelas opsional</option>
                {classes.map((kelas) => <option key={num(kelas.id)} value={num(kelas.id)}>{text(kelas.nama ?? kelas.name ?? kelas.kelas)}</option>)}
              </select>
            </label>
            <label className="block">
              <span className="mb-2 block text-sm font-bold text-[#636E72]">Nama Kelas Manual</span>
              <input className="q-input" value={form.sifir} onChange={(event) => setForm({ ...form, sifir: event.target.value, class_id: '' })} placeholder="Jika kelas belum ada di master" />
            </label>
            <label className="block">
              <span className="mb-2 block text-sm font-bold text-[#636E72]">Ruangan</span>
              <input className="q-input" value={form.ruangan} onChange={(event) => setForm({ ...form, ruangan: event.target.value })} placeholder="Opsional" />
            </label>
            <label className="block md:col-span-2">
              <span className="mb-2 block text-sm font-bold text-[#636E72]">Status</span>
              <select className="q-input" value={form.status} onChange={(event) => setForm({ ...form, status: event.target.value as JadwalFormState['status'] })}>
                <option value="Aktif">Aktif</option>
                <option value="Nonaktif">Nonaktif</option>
              </select>
            </label>
          </form>
        </ModalForm>
      ) : null}

      {deleteTarget ? (
        <ConfirmDialog
          title="Hapus Jadwal?"
          message={`${mapelName(deleteTarget)} pada ${text(deleteTarget.hari)} akan dihapus. Riwayat lama tetap dijaga oleh backend.`}
          tone="danger"
          confirmLabel="Hapus"
          isBusy={isSaving}
          onCancel={() => setDeleteTarget(null)}
          onConfirm={() => void deleteJadwal()}
        />
      ) : null}
    </div>
  );
}
