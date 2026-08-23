import { CalendarDays, CheckCircle2, Pencil, Plus, RefreshCw, RotateCw, Trash2 } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { DataTable, type DataColumn } from '../components/DataTable';
import { ModalForm } from '../components/ModalForm';
import { StatCard } from '../components/StatCard';
import { StatusBadge } from '../components/StatusBadge';
import { api, type ApiRecord } from '../services/api';

function text(value: unknown, fallback = '-'): string {
  const clean = String(value ?? '').trim();
  return clean || fallback;
}

function asNumber(value: unknown): number {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function normalizeSemester(value: unknown): 'ganjil' | 'genap' {
  const clean = String(value ?? '').trim().toLowerCase();
  return clean.includes('genap') ? 'genap' : 'ganjil';
}

interface AcademicFormState {
  id?: number;
  name: string;
  year_start: string;
  year_end: string;
  active_semester: 'ganjil' | 'genap';
}

export function AcademicPage() {
  const [years, setYears] = useState<ApiRecord[]>([]);
  const [active, setActive] = useState<ApiRecord | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deletingYear, setDeletingYear] = useState<ApiRecord | null>(null);
  const [syncingId, setSyncingId] = useState<number | null>(null);
  const [form, setForm] = useState<AcademicFormState | null>(null);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  async function load() {
    setIsLoading(true);
    setError('');
    try {
      const result = await api.academicPeriods();
      setYears(Array.isArray(result.data) ? result.data : []);
      setActive(result.active && typeof result.active === 'object' ? (result.active as ApiRecord) : null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Data akademik gagal dimuat.');
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  const activeSemester = normalizeSemester(active?.semester ?? active?.semester_label ?? (active?.academic_year as ApiRecord | undefined)?.active_semester);
  const activeAcademicYear = active?.academic_year && typeof active.academic_year === 'object' ? (active.academic_year as ApiRecord) : null;

  const columns = useMemo<DataColumn<ApiRecord>[]>(
    () => [
      { key: 'name', header: 'Tahun Ajaran', render: (row) => <span className="font-extrabold">{text(row.name)}</span> },
      { key: 'range', header: 'Periode', render: (row) => `${text(row.year_start)} - ${text(row.year_end)}` },
      { key: 'semester', header: 'Semester Aktif', render: (row) => <StatusBadge label={text(row.active_semester).toUpperCase()} tone="info" /> },
      { key: 'status', header: 'Status', render: (row) => <StatusBadge label={row.is_active ? 'Aktif' : 'Arsip'} tone={row.is_active ? 'success' : 'neutral'} /> },
      {
        key: 'actions',
        header: 'Aksi',
        render: (row) => {
          const id = asNumber(row.id);
          const activeSemester = normalizeSemester(row.active_semester);
          return (
            <div className="flex flex-wrap gap-2">
              <button className="q-soft-action rounded-xl bg-[#EAF4FF] px-3 py-2 text-xs font-extrabold text-[#2E86DE]" onClick={() => openForm(row)} type="button">
                <Pencil size={14} className="inline" /> Edit
              </button>
              <button
                className="q-soft-action rounded-xl bg-[#E8F7F3] px-3 py-2 text-xs font-extrabold text-[#138F81] disabled:opacity-60"
                onClick={() => void activate(id, activeSemester)}
                type="button"
                disabled={isSaving || row.is_active === true}
              >
                Aktifkan
              </button>
              <button
                className="q-soft-action rounded-xl bg-white px-3 py-2 text-xs font-extrabold text-[#138F81] disabled:opacity-60"
                onClick={() => void syncSiswa(row)}
                type="button"
                disabled={syncingId === id}
              >
                <RotateCw size={14} className={`inline ${syncingId === id ? 'animate-spin' : ''}`} /> Sinkron
              </button>
              <button
                className="q-soft-action rounded-xl bg-[#FDECEC] px-3 py-2 text-xs font-extrabold text-[#D63031] hover:bg-[#FCD8D8] disabled:opacity-60 transition-colors"
                onClick={() => setDeletingYear(row)}
                type="button"
                disabled={isSaving || isDeleting}
              >
                <Trash2 size={14} className="inline" /> Hapus
              </button>
            </div>
          );
        }
      }
    ],
    [isSaving, isDeleting, syncingId]
  );

  function openForm(year?: ApiRecord) {
    const start = text(year?.year_start, String(new Date().getFullYear()));
    const end = text(year?.year_end, String(Number(start) + 1));
    setForm({
      id: year?.id ? asNumber(year.id) : undefined,
      name: text(year?.name, `${start}/${end}`),
      year_start: start,
      year_end: end,
      active_semester: normalizeSemester(year?.active_semester)
    });
  }

  async function saveForm() {
    if (!form || isSaving) return;
    const start = Number(form.year_start);
    const end = Number(form.year_end);
    if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) {
      setError('Tahun ajaran tidak valid.');
      return;
    }
    setIsSaving(true);
    setError('');
    try {
      const payload = {
        name: form.name.trim() || `${start}/${end}`,
        year_start: start,
        year_end: end,
        active_semester: form.active_semester
      };
      if (form.id) {
        await api.updateAcademicPeriod(form.id, payload);
      } else {
        await api.createAcademicPeriod(payload);
      }
      setForm(null);
      setNotice('Tahun ajaran berhasil disimpan.');
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Tahun ajaran gagal disimpan.');
    } finally {
      setIsSaving(false);
    }
  }

  async function activate(id: number, semester: string) {
    if (!id || isSaving) return;
    setIsSaving(true);
    setError('');
    try {
      await api.activateAcademicPeriod(id, semester);
      setNotice('Tahun ajaran aktif berhasil diperbarui.');
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Gagal mengaktifkan tahun ajaran.');
    } finally {
      setIsSaving(false);
    }
  }

  async function setSemester(year: ApiRecord, semester: 'ganjil' | 'genap') {
    const id = asNumber(year.id);
    if (!id || isSaving) return;
    setIsSaving(true);
    setError('');
    try {
      await api.setAcademicSemester(id, semester);
      setNotice('Semester aktif berhasil diperbarui.');
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Gagal mengubah semester.');
    } finally {
      setIsSaving(false);
    }
  }

  async function syncSiswa(year: ApiRecord) {
    const id = asNumber(year.id);
    if (!id || syncingId) return;
    setSyncingId(id);
    setError('');
    try {
      const semester = normalizeSemester(year.active_semester);
      const result = await api.syncAcademicPeriodSiswa(id, { semester });
      const data = (result.data && typeof result.data === 'object' ? result.data : {}) as ApiRecord;
      setNotice(`Sinkron selesai. Total: ${data.total_santri ?? 0}, berhasil: ${data.berhasil ?? 0}, sudah ada: ${data.sudah_ada ?? 0}.`);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Sinkronisasi gagal.');
    } finally {
      setSyncingId(null);
    }
  }

  async function handleDelete() {
    if (!deletingYear?.id || isDeleting) return;
    setIsDeleting(true);
    setError('');
    setNotice('');
    try {
      const res = await api.deleteAcademicPeriod(asNumber(deletingYear.id));
      setNotice(res.message || `Tahun ajaran ${text(deletingYear.name)} berhasil dihapus.`);
      setDeletingYear(null);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Gagal menghapus tahun ajaran.');
    } finally {
      setIsDeleting(false);
    }
  }

  return (
    <div className="space-y-6">
      <section className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm font-bold text-[#636E72]">Buku Induk</p>
          <h1 className="text-3xl font-extrabold text-[#2D3436]">Setting Akademik</h1>
          <p className="text-sm font-semibold text-[#636E72]">Tahun ajaran, semester aktif, dan sinkronisasi santri memakai backend Android yang sama.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button className="q-refresh-button inline-flex min-h-11 items-center gap-2 rounded-2xl bg-white px-4 text-sm font-bold text-[#138F81]" onClick={() => void load()} type="button" disabled={isLoading}>
            <RefreshCw className={`q-refresh-icon ${isLoading ? 'animate-spin' : ''}`} size={17} /> Refresh
          </button>
          <button className="q-soft-action inline-flex min-h-11 items-center gap-2 rounded-2xl bg-[#138F81] px-4 text-sm font-extrabold text-white" onClick={() => openForm()} type="button">
            <Plus size={17} /> Tambah Tahun Ajaran
          </button>
        </div>
      </section>

      {error ? <div className="rounded-2xl bg-[#FDECEC] px-4 py-3 text-sm font-bold text-[#D63031]">{error}</div> : null}
      {notice ? <div className="rounded-2xl bg-[#E8F7F3] px-4 py-3 text-sm font-bold text-[#138F81]">{notice}</div> : null}

      <div className="grid gap-4 md:grid-cols-3">
        <StatCard title="Tahun Ajaran Aktif" value={text(active?.tahun_ajaran, '-')} subtitle={text(active?.semester_label, 'Semester belum dipilih')} icon={CalendarDays} tone="teal" />
        <StatCard title="Jumlah Tahun Ajaran" value={years.length} subtitle="Riwayat akademik tersimpan" icon={CheckCircle2} tone="blue" />
        <StatCard title="Semester Aktif" value={text(active?.semester_label ?? active?.semester, '-')} subtitle="Ganjil/Genap tidak menimpa arsip" icon={RotateCw} tone="orange" />
      </div>

      <section className="q-panel p-4 sm:p-6">
        <DataTable rows={years} columns={columns} emptyText={isLoading ? 'Memuat tahun ajaran...' : 'Belum ada tahun ajaran.'} minWidth="860px" />
      </section>

      {activeAcademicYear ? (
        <section className="q-panel p-5">
          <h2 className="text-lg font-extrabold text-[#2D3436]">Ubah Semester Aktif Cepat</h2>
          <p className="mt-1 text-sm font-semibold text-[#636E72]">Data semester lama tetap aman sebagai riwayat. Sistem hanya menyiapkan periode baru.</p>
          <div className="mt-4 flex flex-wrap gap-3">
            <button
              className={`q-soft-action min-h-11 rounded-2xl px-5 text-sm font-extrabold disabled:opacity-60 ${
                activeSemester === 'ganjil' ? 'bg-[#138F81] text-white shadow-lg shadow-[#138F81]/20' : 'bg-white text-[#138F81]'
              }`}
              onClick={() => void setSemester(activeAcademicYear, 'ganjil')}
              type="button"
              disabled={isSaving || activeSemester === 'ganjil'}
            >
              Semester Ganjil
            </button>
            <button
              className={`q-soft-action min-h-11 rounded-2xl px-5 text-sm font-extrabold disabled:opacity-60 ${
                activeSemester === 'genap' ? 'bg-[#138F81] text-white shadow-lg shadow-[#138F81]/20' : 'bg-white text-[#138F81]'
              }`}
              onClick={() => void setSemester(activeAcademicYear, 'genap')}
              type="button"
              disabled={isSaving || activeSemester === 'genap'}
            >
              Semester Genap
            </button>
          </div>
        </section>
      ) : null}

      {form ? (
        <ModalForm
          title={form.id ? 'Edit Tahun Ajaran' : 'Tambah Tahun Ajaran'}
          onClose={() => setForm(null)}
          footer={
            <button className="min-h-12 w-full rounded-2xl bg-[#138F81] text-sm font-extrabold text-white disabled:opacity-60" onClick={() => void saveForm()} type="button" disabled={isSaving}>
              {isSaving ? 'Menyimpan...' : 'Simpan Tahun Ajaran'}
            </button>
          }
        >
          <div className="grid gap-4">
            <label className="grid gap-2 text-sm font-bold text-[#636E72]">
              Nama Tahun Ajaran
              <input className="q-input min-h-12 rounded-2xl bg-white px-4 text-[#2D3436]" value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} placeholder="2025/2026" />
            </label>
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="grid gap-2 text-sm font-bold text-[#636E72]">
                Tahun Mulai
                <input className="q-input min-h-12 rounded-2xl bg-white px-4 text-[#2D3436]" value={form.year_start} onChange={(event) => setForm({ ...form, year_start: event.target.value })} inputMode="numeric" />
              </label>
              <label className="grid gap-2 text-sm font-bold text-[#636E72]">
                Tahun Selesai
                <input className="q-input min-h-12 rounded-2xl bg-white px-4 text-[#2D3436]" value={form.year_end} onChange={(event) => setForm({ ...form, year_end: event.target.value })} inputMode="numeric" />
              </label>
            </div>
            <div>
              <p className="text-sm font-bold text-[#636E72]">Semester Aktif</p>
              <div className="mt-2 grid gap-3 sm:grid-cols-2">
                {(['ganjil', 'genap'] as const).map((semester) => (
                  <button
                    key={semester}
                    className={`min-h-12 rounded-2xl text-sm font-extrabold capitalize transition ${form.active_semester === semester ? 'bg-[#138F81] text-white shadow-lg shadow-[#138F81]/20' : 'bg-white text-[#636E72]'}`}
                    onClick={() => setForm({ ...form, active_semester: semester })}
                    type="button"
                  >
                    {semester}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </ModalForm>
      ) : null}

      {deletingYear ? (
        <ModalForm
          title="Hapus Tahun Ajaran"
          onClose={() => !isDeleting && setDeletingYear(null)}
          footer={
            <div className="flex w-full justify-end gap-2">
              <button
                type="button"
                disabled={isDeleting}
                onClick={() => setDeletingYear(null)}
                className="rounded-2xl border border-gray-200 px-4 py-2.5 text-sm font-bold text-gray-600 hover:bg-gray-100"
              >
                Batal
              </button>
              <button
                type="button"
                disabled={isDeleting}
                onClick={() => void handleDelete()}
                className="rounded-2xl bg-[#D63031] px-5 py-2.5 text-sm font-black text-white shadow-md hover:bg-red-700 disabled:opacity-50"
              >
                {isDeleting ? 'Menghapus...' : 'Ya, Hapus Bersih'}
              </button>
            </div>
          }
        >
          <div className="space-y-3">
            <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-red-800">
              <p className="text-sm font-bold">
                ⚠️ Apakah Anda yakin ingin menghapus Tahun Ajaran <span className="font-extrabold underline">{text(deletingYear.name)}</span>?
              </p>
              <p className="mt-2 text-xs text-red-700 leading-relaxed">
                Tindakan ini akan menghapus tahun ajaran beserta seluruh data tagihan (bills), aturan tagihan, dan riwayat semester terkait secara bersih dari database tanpa meninggalkan data sampah (orphan).
              </p>
            </div>
            {deletingYear.is_active ? (
              <p className="text-xs font-bold text-amber-700 bg-amber-50 border border-amber-200 rounded-xl p-3">
                ℹ️ Tahun ajaran ini sedang <b>Aktif</b>. Setelah dihapus, sistem akan otomatis mengaktifkan tahun ajaran berikutnya yang tersedia.
              </p>
            ) : null}
          </div>
        </ModalForm>
      ) : null}
    </div>
  );
}
