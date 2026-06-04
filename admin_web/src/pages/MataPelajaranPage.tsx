import { BookOpen, Pencil, Plus, RefreshCw, Search, Trash2, UsersRound } from 'lucide-react';
import { FormEvent, useEffect, useMemo, useState } from 'react';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { DataTable, type DataColumn } from '../components/DataTable';
import { ModalForm } from '../components/ModalForm';
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

interface MapelFormState {
  id?: number;
  nama: string;
  kode: string;
  status: 'Aktif' | 'Nonaktif';
  guruIds: Set<number>;
}

export function MataPelajaranPage() {
  const [rows, setRows] = useState<ApiRecord[]>([]);
  const [teachers, setTeachers] = useState<ApiRecord[]>([]);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('Semua');
  const [form, setForm] = useState<MapelFormState | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<ApiRecord | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  async function load() {
    setIsLoading(true);
    setError('');
    try {
      const [mapelResult, teacherResult] = await Promise.all([
        api.mataPelajaran({ status: statusFilter === 'Semua' ? '' : statusFilter }),
        api.users({ role: 'guru', status: 'Aktif' })
      ]);
      setRows(Array.isArray(mapelResult.data) ? mapelResult.data : []);
      setTeachers(Array.isArray(teacherResult.data) ? teacherResult.data : []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Mata pelajaran gagal dimuat.');
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [statusFilter]);

  const filtered = useMemo(() => {
    const keyword = search.toLowerCase();
    if (!keyword) return rows;
    return rows.filter((row) => {
      const guruNames = list(row.guru).map((guru) => guru.name).join(' ');
      return `${row.nama ?? ''} ${row.kode ?? ''} ${guruNames}`.toLowerCase().includes(keyword);
    });
  }, [rows, search]);

  const activeCount = rows.filter((row) => text(row.status) === 'Aktif').length;
  const teacherConnected = rows.reduce((sum, row) => sum + list(row.guru).length, 0);

  const columns = useMemo<DataColumn<ApiRecord>[]>(
    () => [
      { key: 'nama', header: 'Mata Pelajaran', render: (row) => <span className="font-extrabold">{text(row.nama)}</span> },
      { key: 'kode', header: 'Kode', render: (row) => text(row.kode) },
      {
        key: 'guru',
        header: 'Guru Pengajar',
        render: (row) => {
          const gurus = list(row.guru);
          return gurus.length ? gurus.map((guru) => text(guru.name)).join(', ') : 'Belum terhubung';
        }
      },
      { key: 'jadwal', header: 'Jadwal Aktif', render: (row) => `${list(row.jadwal).length} jadwal` },
      {
        key: 'status',
        header: 'Status',
        render: (row) => <StatusBadge label={text(row.status, 'Aktif')} tone={text(row.status) === 'Aktif' ? 'success' : 'danger'} />
      },
      {
        key: 'aksi',
        header: 'Aksi',
        render: (row) => (
          <div className="flex flex-wrap gap-2">
            <button className="rounded-xl bg-[#EAF4FF] px-3 py-2 text-xs font-bold text-[#2E86DE]" onClick={() => openForm(row)} type="button">
              <Pencil size={14} className="inline" /> Edit
            </button>
            <button className="rounded-xl bg-[#FDECEC] px-3 py-2 text-xs font-bold text-[#D63031]" onClick={() => setDeleteTarget(row)} type="button">
              <Trash2 size={14} className="inline" /> Hapus
            </button>
          </div>
        )
      }
    ],
    []
  );

  function openForm(row?: ApiRecord) {
    setForm({
      id: row?.id ? num(row.id) : undefined,
      nama: text(row?.nama, ''),
      kode: text(row?.kode, ''),
      status: text(row?.status, 'Aktif') === 'Nonaktif' ? 'Nonaktif' : 'Aktif',
      guruIds: new Set(list(row?.guru).map((guru) => num(guru.id)).filter(Boolean))
    });
  }

  async function saveForm(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!form || isSaving) return;
    setIsSaving(true);
    setError('');
    try {
      const payload = {
        nama: form.nama.trim(),
        kode: form.kode.trim() || null,
        status: form.status,
        guru_ids: Array.from(form.guruIds)
      };
      if (form.id) {
        await api.updateMataPelajaran(form.id, payload);
      } else {
        await api.createMataPelajaran(payload);
      }
      setForm(null);
      setNotice('Mata pelajaran berhasil disimpan.');
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Mata pelajaran gagal disimpan.');
    } finally {
      setIsSaving(false);
    }
  }

  async function deleteMapel() {
    if (!deleteTarget?.id || isSaving) return;
    setIsSaving(true);
    setError('');
    try {
      await api.deleteMataPelajaran(num(deleteTarget.id));
      setDeleteTarget(null);
      setNotice('Mata pelajaran berhasil dihapus.');
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Mata pelajaran gagal dihapus.');
    } finally {
      setIsSaving(false);
    }
  }

  function toggleTeacher(id: number) {
    if (!form) return;
    const next = new Set(form.guruIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setForm({ ...form, guruIds: next });
  }

  return (
    <div className="space-y-6">
      <section className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm font-bold text-[#636E72]">Akademik</p>
          <h1 className="text-3xl font-extrabold text-[#2D3436]">Mata Pelajaran</h1>
          <p className="text-sm font-semibold text-[#636E72]">Master mapel dan guru pengajar memakai endpoint yang sama dengan Android.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button className={`q-refresh-button inline-flex min-h-11 items-center gap-2 rounded-2xl bg-white px-4 text-sm font-bold text-[#138F81] ${isLoading ? 'is-loading' : ''}`} onClick={() => void load()} type="button" disabled={isLoading}>
            <RefreshCw className="q-refresh-icon" size={17} /> {isLoading ? 'Memuat...' : 'Refresh'}
          </button>
          <button className="inline-flex min-h-11 items-center gap-2 rounded-2xl bg-[#138F81] px-4 text-sm font-extrabold text-white shadow-lg shadow-[#138F81]/20" onClick={() => openForm()} type="button">
            <Plus size={17} /> Tambah Mapel
          </button>
        </div>
      </section>

      {error ? <div className="rounded-2xl bg-[#FDECEC] px-4 py-3 text-sm font-bold text-[#D63031]">{error}</div> : null}
      {notice ? <div className="rounded-2xl bg-[#E8F7F3] px-4 py-3 text-sm font-bold text-[#138F81]">{notice}</div> : null}

      <div className="grid gap-4 md:grid-cols-3">
        <StatCard title="Total Mapel" value={rows.length} subtitle={`${activeCount} mapel aktif`} icon={BookOpen} tone="teal" />
        <StatCard title="Guru Terhubung" value={teacherConnected} subtitle={`${teachers.length} guru aktif tersedia`} icon={UsersRound} tone="blue" />
        <StatCard title="Filter Tampil" value={filtered.length} subtitle={statusFilter} icon={Search} tone="orange" />
      </div>

      <section className="q-panel p-4 sm:p-6">
        <div className="mb-5 grid gap-3 lg:grid-cols-[1fr_220px]">
          <SearchInput value={search} onChange={setSearch} placeholder="Cari nama mapel / kode / guru" />
          <select className="q-input" value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}>
            <option value="Semua">Semua status</option>
            <option value="Aktif">Aktif</option>
            <option value="Nonaktif">Nonaktif</option>
          </select>
        </div>
        <DataTable rows={filtered} columns={columns} emptyText={isLoading ? 'Memuat mata pelajaran...' : 'Belum ada mata pelajaran.'} minWidth="900px" />
      </section>

      {form ? (
        <ModalForm
          title={form.id ? 'Edit Mata Pelajaran' : 'Tambah Mata Pelajaran'}
          onClose={() => setForm(null)}
          footer={
            <button className="min-h-12 w-full rounded-2xl bg-[#138F81] text-sm font-extrabold text-white disabled:opacity-60" disabled={isSaving} form="mapel-form" type="submit">
              {isSaving ? 'Menyimpan...' : 'Simpan Mata Pelajaran'}
            </button>
          }
        >
          <form id="mapel-form" className="space-y-4" onSubmit={saveForm}>
            <label className="block">
              <span className="mb-2 block text-sm font-bold text-[#636E72]">Nama Mata Pelajaran</span>
              <input className="q-input" value={form.nama} onChange={(event) => setForm({ ...form, nama: event.target.value })} required />
            </label>
            <label className="block">
              <span className="mb-2 block text-sm font-bold text-[#636E72]">Kode</span>
              <input className="q-input" value={form.kode} onChange={(event) => setForm({ ...form, kode: event.target.value })} placeholder="Opsional" />
            </label>
            <div className="grid grid-cols-2 gap-3">
              {(['Aktif', 'Nonaktif'] as const).map((status) => (
                <button key={status} className={`min-h-12 rounded-2xl text-sm font-extrabold ${form.status === status ? 'bg-[#138F81] text-white' : 'bg-white text-[#636E72]'}`} onClick={() => setForm({ ...form, status })} type="button">
                  {status}
                </button>
              ))}
            </div>
            <div className="rounded-3xl bg-white p-4">
              <p className="mb-3 text-sm font-extrabold text-[#2D3436]">Guru Pengajar</p>
              <div className="grid max-h-64 gap-2 overflow-y-auto q-scrollbar">
                {teachers.length === 0 ? (
                  <p className="rounded-2xl bg-[#E1EFF7] px-4 py-3 text-sm font-bold text-[#636E72]">Belum ada guru aktif.</p>
                ) : (
                  teachers.map((teacher) => {
                    const id = num(teacher.id);
                    const selected = form.guruIds.has(id);
                    return (
                      <button
                        key={id}
                        className={`flex items-center justify-between rounded-2xl px-4 py-3 text-left transition ${selected ? 'bg-[#E8F7F3] text-[#138F81]' : 'bg-[#F8FBFC] text-[#2D3436] hover:bg-[#E1EFF7]'}`}
                        onClick={() => toggleTeacher(id)}
                        type="button"
                      >
                        <span>
                          <span className="block text-sm font-extrabold">{text(teacher.name)}</span>
                          <span className="block text-xs font-semibold text-[#636E72]">{text(teacher.kode_guru ?? teacher.email)}</span>
                        </span>
                        <span className="text-xs font-extrabold">{selected ? 'Dipilih' : 'Pilih'}</span>
                      </button>
                    );
                  })
                )}
              </div>
            </div>
          </form>
        </ModalForm>
      ) : null}

      {deleteTarget ? (
        <ConfirmDialog
          title="Hapus Mata Pelajaran?"
          message={`${text(deleteTarget.nama)} akan dihapus. Jika sudah terkait jadwal/absensi, pastikan data lama tetap aman di backend.`}
          tone="danger"
          confirmLabel="Hapus"
          isBusy={isSaving}
          onCancel={() => setDeleteTarget(null)}
          onConfirm={() => void deleteMapel()}
        />
      ) : null}
    </div>
  );
}
