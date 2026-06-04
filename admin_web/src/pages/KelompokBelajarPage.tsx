import { BookOpen, Pencil, Plus, RefreshCw, Search, Trash2, UserPlus, UsersRound, X } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { DataTable, type DataColumn } from '../components/DataTable';
import { ModalForm } from '../components/ModalForm';
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

interface KelompokFormState {
  id?: number;
  nama: string;
  kategori: string;
  sifir: string;
  class_id?: number;
}

function flattenGroups(groups: ApiRecord[]): ApiRecord[] {
  return groups.flatMap((group) => {
    const kelas = Array.isArray(group.kelas) ? group.kelas : [];
    return kelas.map((item) => ({
      ...(item as ApiRecord),
      kategori: group.kategori ?? (item as ApiRecord).kategori
    }));
  });
}

export function KelompokBelajarPage() {
  const [groups, setGroups] = useState<ApiRecord[]>([]);
  const [rows, setRows] = useState<ApiRecord[]>([]);
  const [students, setStudents] = useState<ApiRecord[]>([]);
  const [detail, setDetail] = useState<ApiRecord | null>(null);
  const [form, setForm] = useState<KelompokFormState | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<ApiRecord | null>(null);
  const [studentSearch, setStudentSearch] = useState('');
  const [search, setSearch] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

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

  async function loadStudents() {
    try {
      const result = await api.siswa({ status: 'Aktif' });
      setStudents(Array.isArray(result.data) ? result.data : []);
    } catch {
      setStudents([]);
    }
  }

  useEffect(() => {
    void load();
    void loadStudents();
  }, []);

  const filtered = useMemo(() => {
    const keyword = search.toLowerCase();
    if (!keyword) return rows;
    return rows.filter((row) => JSON.stringify(row).toLowerCase().includes(keyword));
  }, [rows, search]);

  const detailStudents = useMemo(() => (Array.isArray(detail?.siswa) ? (detail.siswa as ApiRecord[]) : []), [detail]);
  const availableStudents = useMemo(() => {
    const attachedIds = new Set(detailStudents.map((student) => asNumber(student.id)));
    const keyword = studentSearch.toLowerCase();
    return students
      .filter((student) => !attachedIds.has(asNumber(student.id)))
      .filter((student) => {
        if (!keyword) return true;
        return `${student.nama ?? ''} ${student.nis ?? ''} ${student.nisn ?? ''} ${student.kelas ?? ''}`.toLowerCase().includes(keyword);
      })
      .slice(0, 20);
  }, [students, detailStudents, studentSearch]);

  const columns = useMemo<DataColumn<ApiRecord>[]>(
    () => [
      { key: 'nama', header: 'Nama Kelompok', render: (row) => <span className="font-extrabold">{text(row.nama)}</span> },
      { key: 'kategori', header: 'Kategori', render: (row) => text(row.kategori) },
      { key: 'sifir', header: 'Sifir', render: (row) => text(row.sifir) },
      { key: 'siswa', header: 'Siswa', render: (row) => `${asNumber(row.jumlah_siswa)} santri` },
      { key: 'mapel', header: 'Mapel Aktif', render: (row) => asNumber(row.jumlah_mapel_aktif) },
      {
        key: 'aksi',
        header: 'Aksi',
        render: (row) => (
          <div className="flex flex-wrap gap-2">
            <button className="q-soft-action rounded-xl bg-[#E8F7F3] px-3 py-2 text-xs font-extrabold text-[#138F81]" onClick={() => void openDetail(row)} type="button">
              Detail
            </button>
            <button className="q-soft-action rounded-xl bg-[#EAF4FF] px-3 py-2 text-xs font-extrabold text-[#2E86DE]" onClick={() => openForm(row)} type="button">
              <Pencil size={14} className="inline" /> Edit
            </button>
            <button className="q-soft-action rounded-xl bg-[#FDECEC] px-3 py-2 text-xs font-extrabold text-[#D63031]" onClick={() => setDeleteTarget(row)} type="button">
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
      id: row?.id ? asNumber(row.id) : undefined,
      nama: text(row?.nama, ''),
      kategori: text(row?.kategori, 'Sifir'),
      sifir: text(row?.sifir ?? row?.nama, ''),
      class_id: row?.class_id ? asNumber(row.class_id) : undefined
    });
  }

  async function saveForm() {
    if (!form || isSaving) return;
    if (!form.nama.trim() || !form.kategori.trim() || !form.sifir.trim()) {
      setError('Nama, kategori, dan sifir wajib diisi.');
      return;
    }
    setIsSaving(true);
    setError('');
    try {
      const payload = {
        nama: form.nama.trim(),
        kategori: form.kategori.trim(),
        sifir: form.sifir.trim(),
        ...(form.class_id ? { class_id: form.class_id } : {})
      };
      if (form.id) {
        await api.updateKelompokBelajar(form.id, payload);
      } else {
        await api.createKelompokBelajar(payload);
      }
      setForm(null);
      setNotice('Kelompok belajar berhasil disimpan.');
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Kelompok gagal disimpan.');
    } finally {
      setIsSaving(false);
    }
  }

  async function openDetail(row: ApiRecord) {
    const id = asNumber(row.id);
    if (!id) return;
    setError('');
    try {
      const result = await api.kelompokBelajarDetail(id);
      setDetail(result.data && typeof result.data === 'object' ? (result.data as ApiRecord) : row);
      setStudentSearch('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Detail kelompok gagal dimuat.');
    }
  }

  async function refreshDetail() {
    if (!detail?.id) return;
    await openDetail(detail);
  }

  async function addStudent(studentId: number) {
    if (!detail?.id || isSaving) return;
    setIsSaving(true);
    setError('');
    try {
      await api.addSiswaToKelompok(asNumber(detail.id), studentId);
      await refreshDetail();
      await load();
      setNotice('Santri berhasil ditambahkan ke kelompok.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Santri gagal ditambahkan.');
    } finally {
      setIsSaving(false);
    }
  }

  async function removeStudent(studentId: number) {
    if (!detail?.id || isSaving) return;
    setIsSaving(true);
    setError('');
    try {
      await api.removeSiswaFromKelompok(asNumber(detail.id), studentId);
      await refreshDetail();
      await load();
      setNotice('Santri berhasil dihapus dari kelompok.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Santri gagal dihapus.');
    } finally {
      setIsSaving(false);
    }
  }

  async function deleteGroup() {
    if (!deleteTarget?.id || isSaving) return;
    setIsSaving(true);
    setError('');
    try {
      await api.deleteKelompokBelajar(asNumber(deleteTarget.id));
      setDeleteTarget(null);
      setNotice('Kelompok belajar berhasil dihapus.');
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Kelompok gagal dihapus.');
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      <section className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm font-bold text-[#636E72]">Buku Induk</p>
          <h1 className="text-3xl font-extrabold text-[#2D3436]">Kelompok Belajar</h1>
          <p className="text-sm font-semibold text-[#636E72]">Kelola kelompok sifir/kelas dan anggota santri memakai backend yang sama dengan Android.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button className="q-refresh-button inline-flex min-h-11 items-center gap-2 rounded-2xl bg-white px-4 text-sm font-bold text-[#138F81]" onClick={() => void load()} type="button" disabled={isLoading}>
            <RefreshCw className={`q-refresh-icon ${isLoading ? 'animate-spin' : ''}`} size={17} /> Refresh
          </button>
          <button className="q-soft-action inline-flex min-h-11 items-center gap-2 rounded-2xl bg-[#138F81] px-4 text-sm font-extrabold text-white" onClick={() => openForm()} type="button">
            <Plus size={17} /> Tambah Kelompok
          </button>
        </div>
      </section>

      {error ? <div className="rounded-2xl bg-[#FDECEC] px-4 py-3 text-sm font-bold text-[#D63031]">{error}</div> : null}
      {notice ? <div className="rounded-2xl bg-[#E8F7F3] px-4 py-3 text-sm font-bold text-[#138F81]">{notice}</div> : null}

      <div className="grid gap-4 md:grid-cols-3">
        <StatCard title="Total Kelompok" value={rows.length} subtitle={`${groups.length} kategori`} icon={BookOpen} tone="teal" />
        <StatCard title="Total Anggota" value={rows.reduce((sum, row) => sum + asNumber(row.jumlah_siswa), 0)} subtitle="Santri aktif dalam kelompok" icon={UsersRound} tone="blue" />
        <StatCard title="Mapel Aktif" value={rows.reduce((sum, row) => sum + asNumber(row.jumlah_mapel_aktif), 0)} subtitle="Terhubung ke jadwal/mapel" icon={Search} tone="orange" />
      </div>

      <section className="q-panel p-4 sm:p-6">
        <div className="mb-5">
          <SearchInput value={search} onChange={setSearch} placeholder="Cari nama kelompok / kategori / sifir" />
        </div>
        <DataTable rows={filtered} columns={columns} emptyText={isLoading ? 'Memuat kelompok...' : 'Belum ada kelompok belajar.'} minWidth="860px" />
      </section>

      {form ? (
        <ModalForm
          title={form.id ? 'Edit Kelompok Belajar' : 'Tambah Kelompok Belajar'}
          onClose={() => setForm(null)}
          footer={
            <button className="min-h-12 w-full rounded-2xl bg-[#138F81] text-sm font-extrabold text-white disabled:opacity-60" onClick={() => void saveForm()} type="button" disabled={isSaving}>
              {isSaving ? 'Menyimpan...' : 'Simpan Kelompok'}
            </button>
          }
        >
          <div className="grid gap-4">
            <label className="grid gap-2 text-sm font-bold text-[#636E72]">
              Nama Kelompok
              <input className="q-input min-h-12 rounded-2xl bg-white px-4 text-[#2D3436]" value={form.nama} onChange={(event) => setForm({ ...form, nama: event.target.value })} placeholder="Sifir Awal A PA" />
            </label>
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="grid gap-2 text-sm font-bold text-[#636E72]">
                Kategori
                <input className="q-input min-h-12 rounded-2xl bg-white px-4 text-[#2D3436]" value={form.kategori} onChange={(event) => setForm({ ...form, kategori: event.target.value })} placeholder="Sifir" />
              </label>
              <label className="grid gap-2 text-sm font-bold text-[#636E72]">
                Sifir/Level
                <input className="q-input min-h-12 rounded-2xl bg-white px-4 text-[#2D3436]" value={form.sifir} onChange={(event) => setForm({ ...form, sifir: event.target.value })} placeholder="Awal" />
              </label>
            </div>
          </div>
        </ModalForm>
      ) : null}

      {detail ? (
        <ModalForm title={`Anggota ${text(detail.nama)}`} onClose={() => setDetail(null)}>
          <div className="space-y-5">
            <SearchInput value={studentSearch} onChange={setStudentSearch} placeholder="Cari santri aktif untuk ditambahkan" />
            <div className="rounded-3xl bg-white p-4">
              <h3 className="mb-3 text-sm font-extrabold text-[#2D3436]">Tambah Santri</h3>
              <div className="grid gap-2">
                {availableStudents.length === 0 ? (
                  <p className="rounded-2xl bg-[#E1EFF7] px-4 py-3 text-sm font-bold text-[#636E72]">Tidak ada santri tersedia pada pencarian ini.</p>
                ) : (
                  availableStudents.map((student) => (
                    <button
                      key={String(student.id)}
                      className="flex items-center justify-between gap-3 rounded-2xl bg-[#F8FBFC] px-4 py-3 text-left transition hover:bg-[#E1EFF7]"
                      onClick={() => void addStudent(asNumber(student.id))}
                      type="button"
                      disabled={isSaving}
                    >
                      <span>
                        <span className="block text-sm font-extrabold text-[#2D3436]">{text(student.nama)}</span>
                        <span className="block text-xs font-semibold text-[#636E72]">NIS: {text(student.nis)} - {text(student.kelas)}</span>
                      </span>
                      <UserPlus size={18} className="text-[#138F81]" />
                    </button>
                  ))
                )}
              </div>
            </div>
            <div className="rounded-3xl bg-white p-4">
              <h3 className="mb-3 text-sm font-extrabold text-[#2D3436]">{detailStudents.length} Santri dalam kelompok</h3>
              <div className="grid gap-2">
                {detailStudents.length === 0 ? (
                  <p className="rounded-2xl bg-[#E1EFF7] px-4 py-3 text-sm font-bold text-[#636E72]">Belum ada santri dalam kelompok ini.</p>
                ) : (
                  detailStudents.map((student) => (
                    <div key={String(student.id)} className="flex items-center justify-between gap-3 rounded-2xl bg-[#F8FBFC] px-4 py-3">
                      <span>
                        <span className="block text-sm font-extrabold text-[#2D3436]">{text(student.nama)}</span>
                        <span className="block text-xs font-semibold text-[#636E72]">NIS: {text(student.nis)} - {text(student.jenis_kelamin)}</span>
                      </span>
                      <button className="grid h-9 w-9 place-items-center rounded-xl bg-[#FDECEC] text-[#D63031]" onClick={() => void removeStudent(asNumber(student.id))} type="button" disabled={isSaving} aria-label="Hapus santri">
                        <X size={17} />
                      </button>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </ModalForm>
      ) : null}

      {deleteTarget ? (
        <ConfirmDialog
          title="Hapus Kelompok?"
          message={`Kelompok ${text(deleteTarget.nama)} akan dihapus dan relasi anggota dilepas. Data siswa utama tetap aman.`}
          tone="danger"
          confirmLabel="Hapus"
          isBusy={isSaving}
          onCancel={() => setDeleteTarget(null)}
          onConfirm={() => void deleteGroup()}
        />
      ) : null}
    </div>
  );
}
